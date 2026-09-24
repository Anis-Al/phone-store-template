// Admin / database checks. Run: npm test (in-memory libSQL, no server needed).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDbAdapter } from "./data/adapters/db.ts";
import type { OrderDraft, ProductInput } from "./data/schemas";
import { migrate, openDb } from "./db/client.ts";
import { canTransition, OutOfStockError } from "./order.ts";
import { hashPassword, signSession, verifyPassword, verifySession } from "./session.ts";

async function setup() {
  const db = openDb(":memory:");
  await migrate(db);
  const repo = createDbAdapter(db, "MS", ["phones", "accessories"]);
  const product: ProductInput = {
    slug: "phone-x", category: "phones", brand: "Acme", model: "X", name: "Acme X", description: "d", images: ["/x.webp"],
    basePrice: 1000, condition: "new", tags: [], featured: false,
    specs: { screen: "", chipset: "", ram: 8, storage: "", battery: "", mainCamera: "", frontCamera: "", os: "", network: "" },
    variants: [
      { sku: "X-128", color: { name: "Noir", hex: "#000000" }, storage: 128, stockQty: 3 },
      { sku: "X-256", color: { name: "Noir", hex: "#000000" }, storage: 256, stockQty: 1, priceOverride: 1200 },
    ],
  };
  const saved = await repo.saveProduct(product, 1);
  return { db, repo, saved };
}

const draft = (sku: string, qty = 1): OrderDraft => ({
  items: [{ sku, qty, unitPrice: 1000, label: sku }],
  totals: { subtotal: 1000 * qty, deliveryFee: 0, total: 1000 * qty },
  fulfillment: "pickup",
  paymentMethod: "instore",
  customer: { name: "Test", phone: "0555123456" },
});

const stockOf = async (repo: Awaited<ReturnType<typeof setup>>["repo"], sku: string) =>
  (await repo.listVariants()).find((v) => v.sku === sku)!.stock;

test("20 parallel orders on a SKU with stock 3 → exactly 3 succeed, refs are sequential", async () => {
  const { repo } = await setup();
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => repo.createOrder(draft("X-128"))));
  const ok = results.filter((r) => r.status === "fulfilled");
  assert.equal(ok.length, 3);
  assert.ok(results.every((r) => r.status === "fulfilled" || r.reason instanceof OutOfStockError));
  assert.deepEqual(ok.map((r) => r.value.id).sort(), ["MS-1001", "MS-1002", "MS-1003"]);
  assert.equal(await stockOf(repo, "X-128"), 0);
});

test("a failed line rolls back the whole order", async () => {
  const { repo } = await setup();
  const two = { ...draft("X-128"), items: [{ sku: "X-128", qty: 1, unitPrice: 1000, label: "a" }, { sku: "X-256", qty: 2, unitPrice: 1200, label: "b" }] };
  await assert.rejects(repo.createOrder(two), (e) => e instanceof OutOfStockError && e.sku === "X-256");
  assert.equal(await stockOf(repo, "X-128"), 3);
  assert.equal((await repo.listOrders({ page: 1, pageSize: 10 })).total, 0);
});

test("status machine: only forward moves; cancel restores stock exactly once", async () => {
  assert.ok(canTransition("new", "confirmed") && canTransition("ready", "cancelled"));
  assert.ok(!canTransition("new", "done") && !canTransition("cancelled", "new") && !canTransition("done", "cancelled"));

  const { repo } = await setup();
  const order = await repo.createOrder(draft("X-128", 2));
  assert.equal(await stockOf(repo, "X-128"), 1);
  await assert.rejects(repo.setOrderStatus(order.id, "done", 1), /invalid_transition/);
  await repo.setOrderStatus(order.id, "confirmed", 1);
  // Double-click: both requests read "confirmed" before either writes.
  const both = await Promise.allSettled([repo.setOrderStatus(order.id, "cancelled", 1), repo.setOrderStatus(order.id, "cancelled", 1)]);
  assert.equal(both.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stockOf(repo, "X-128"), 3);
  await assert.rejects(repo.setOrderStatus(order.id, "cancelled", 1), /invalid_transition/);
  assert.equal(await stockOf(repo, "X-128"), 3);
  const moves = (await repo.stockMovements({ sku: "X-128", page: 1, pageSize: 20 })).rows.map((m) => `${m.reason}:${m.delta}`);
  assert.deepEqual(moves, ["cancel:2", "order:-2", "edit:3"]);
  assert.deepEqual((await repo.audit("order", order.id)).map((a) => a.action), ["status", "status"]);
});

test("editor stock is a delta: an order placed while editing still counts", async () => {
  const { repo, saved } = await setup();
  const loaded = saved.variants.map((v) => ({ ...v, prevSku: v.sku, stockWas: v.stockQty }));
  await repo.createOrder(draft("X-128")); // 3 → 2 while the owner has the editor open
  const input = { ...saved, variants: loaded.map((v) => (v.sku === "X-128" ? { ...v, stockQty: 5 } : v)) };
  await repo.saveProduct(input, 1); // owner typed 5 over the 3 they saw: +2
  assert.equal(await stockOf(repo, "X-128"), 4);
  await assert.rejects(repo.updateVariants([{ sku: "X-256", stock: { delta: -2 } }], "manual", 1), /negative_stock/);
  await repo.updateVariants([{ sku: "X-256", stock: { set: 7 }, price: 1500 }], "import", 1);
  const row = (await repo.listVariants()).find((v) => v.sku === "X-256")!;
  assert.deepEqual([row.stock, row.price], [7, 1500]);
});

test("SKU is locked once ordered; archived products leave the storefront", async () => {
  const { repo, saved } = await setup();
  await repo.createOrder(draft("X-256"));
  const renamed = { ...saved, variants: saved.variants.map((v) => ({ ...v, prevSku: v.sku, sku: `${v.sku}-B` })) };
  await assert.rejects(repo.saveProduct(renamed, 1), /sku_locked/);
  await repo.setArchived(saved.id, true, 1);
  assert.equal(await repo.getProductBySlug("phone-x"), null);
  assert.deepEqual(await repo.getVariants(["X-128"]), []);
  assert.equal((await repo.listProducts({ archived: true })).length, 1);
});

test("accessory: no spec sheet, no storage; round-trips and reserves stock", async () => {
  const { repo } = await setup();
  const saved = await repo.saveProduct(
    {
      slug: "case-x", category: "accessories", brand: "Acme", model: "Case", name: "Coque X", description: "d",
      images: ["/c.webp"], basePrice: 1500, condition: "new", tags: ["acme x"], featured: false,
      variants: [
        { sku: "CASE-NOIR", color: { name: "Noir", hex: "#000000" }, stockQty: 2 },
        { sku: "CASE-BLEU", color: { name: "Bleu", hex: "#0000ff" }, stockQty: 1 },
      ],
    },
    1,
  );
  assert.equal(saved.category, "accessories");
  assert.equal(saved.specs, undefined);
  assert.deepEqual(saved.variants.map((v) => [v.sku, v.storage]), [["CASE-NOIR", undefined], ["CASE-BLEU", undefined]]);
  assert.deepEqual((await repo.listProducts({ category: "accessories" })).map((p) => p.slug), ["case-x"]);
  await repo.createOrder(draft("CASE-NOIR", 2));
  assert.equal(await stockOf(repo, "CASE-NOIR"), 0);
  assert.equal((await repo.listVariants()).find((v) => v.sku === "CASE-BLEU")!.storage, null);
});

test("migration 002 keeps existing rows; a category missing from the config reads as the primary one", async () => {
  const { cp, mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const src = path.join(process.cwd(), "lib", "db", "migrations");
  const dir = await mkdtemp(path.join(tmpdir(), "migrations-"));
  try {
    await cp(path.join(src, "001_init.sql"), path.join(dir, "001_init.sql"));
    const db = openDb(":memory:");
    await migrate(db, dir);
    await db.batch([
      `INSERT INTO products (id, slug, brand, model, name, description, condition, specs, images, base_price, created_at, updated_at)
         VALUES ('p1', 'old', 'Acme', 'X', 'Acme X', 'd', 'new', 'null', '["/x.webp"]', 100, '2025-01-01', '2025-01-01')`,
      "INSERT INTO variants (sku, product_id, color_name, color_hex, storage, stock_qty) VALUES ('OLD-128', 'p1', 'Noir', '#000000', 128, 4)",
    ], "write");
    await cp(path.join(src, "002_categories.sql"), path.join(dir, "002_categories.sql"));
    assert.deepEqual(await migrate(db, dir), ["002_categories.sql"]);
    const p = (await db.execute("SELECT category FROM products WHERE id = 'p1'")).rows[0];
    const v = (await db.execute("SELECT storage, stock_qty FROM variants WHERE sku = 'OLD-128'")).rows[0];
    assert.deepEqual([p.category, v.storage, v.stock_qty], ["phones", 128, 4]);
    await db.execute("INSERT INTO variants (sku, product_id, color_name, color_hex, stock_qty) VALUES ('NEW', 'p1', 'Noir', '#000000', 1)");
    await assert.rejects(db.execute("INSERT INTO variants (sku, product_id, color_name, color_hex, storage, stock_qty) VALUES ('ZERO', 'p1', 'Noir', '#000000', 0, 1)"), /CHECK/);
    const repo = createDbAdapter(db, "MS", ["telephones", "accessoires"]);
    assert.equal((await repo.getProductBySlug("old"))?.category, "telephones");
    assert.deepEqual((await repo.getProducts({ category: "telephones" })).map((x) => x.slug), ["old"]);
    assert.equal((await repo.listProducts({ category: "telephones" })).length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("passwords and sessions: verify, tamper, expiry", async () => {
  const hash = await hashPassword("correct horse");
  assert.ok(await verifyPassword("correct horse", hash));
  assert.ok(!(await verifyPassword("wrong horse!", hash)));

  const secret = "s".repeat(32);
  const token = signSession(7, 2, secret, 1_000_000_000_000);
  assert.deepEqual(verifySession(token, secret, 1_000_000_000_001), { userId: 7, version: 2, expires: 1_000_000_000_000 + 7 * 86_400_000 });
  assert.equal(verifySession(token.replace(/^7\./, "1."), secret, 1_000_000_000_001), null); // tampered user id
  assert.equal(verifySession(token, "t".repeat(32), 1_000_000_000_001), null); // other secret
  assert.equal(verifySession(token, secret, 1_000_000_000_000 + 8 * 86_400_000), null); // expired
});

test("uploads: raster images re-encoded to ≤1200 px WebP; SVG, fakes and oversize refused", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const sharp = (await import("sharp")).default;
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), "media-"));
  const { putImage, readImage } = await import("./media.ts");

  const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#336699" } }).png().toBuffer();
  const url = await putImage(new File([new Uint8Array(png)], "x.png"));
  assert.match(url, /^\/media\/[a-f0-9]{32}\.webp$/);
  const meta = await sharp((await readImage(url.slice(7)))!).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1200, 600]);

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>';
  await assert.rejects(putImage(new File([svg], "x.svg")), /upload/);
  await assert.rejects(putImage(new File(["<html>hi</html>"], "x.png")), /upload/);
  await assert.rejects(putImage(new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg")), /upload/);
  assert.equal(await readImage("../../etc/passwd"), null);
});

test("stock CSV: header by name, ; separator, quotes, invalid rows listed", async () => {
  const { parseStockCsv, toCsv } = await import("./csv.ts");
  const exported = toCsv([["sku", "product", "color", "storage", "price", "stock"], ["A-1", 'Galaxy "S25", 5G', "Noir", 256, 1000, 3]]);
  assert.deepEqual(parseStockCsv(exported).rows, [{ line: 2, sku: "A-1", price: 1000, stock: 3 }]);
  const r = parseStockCsv("sku;prix;stock\nA-1;;5\nB 2;10;1\nC-3;abc;1\nD-4;20;\n");
  assert.deepEqual(r.rows, [{ line: 2, sku: "A-1", price: undefined, stock: 5 }, { line: 5, sku: "D-4", price: 20, stock: undefined }]);
  assert.deepEqual(r.invalid.map((i) => i.line), [3, 4]);
  assert.deepEqual(parseStockCsv("A-1,100,2").rows, [{ line: 1, sku: "A-1", price: 100, stock: 2 }]); // no header
});
