// Run: npm test  (node's built-in runner + type stripping, no test framework)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cellKey, facets, filterProducts, filtersToQuery, fromPrice, fuzzyScore, moveAxis, parseFilters, relatedProducts, stockLevel, withCategory,
} from "./catalog.ts";
import { productInputSchema, productsFileSchema, type Product } from "./data/schemas.ts";
import { deliveryFee, dzPhone, orderInputSchema, priceOrder, repriceEdit } from "./order.ts";

const mk = (id: string, brand: string, ram: number, variants: [number, number, number][]): Product => ({
  id, slug: id, category: "phones", brand, model: id, name: `${brand} ${id}`, description: "", images: ["/x.webp"],
  basePrice: variants[0][1], condition: "new", tags: [], featured: false, createdAt: "2025-01-01",
  specs: { screen: "", chipset: "", ram, storage: "", battery: "", mainCamera: "", frontCamera: "", os: "", network: "" },
  variants: variants.map(([storage, price, stockQty], i) => ({
    sku: `${id}-${i}`, productId: id, color: { name: "Noir", hex: "#000000" }, storage,
    priceOverride: price, stockQty,
  })),
});

const a = mk("a", "Apple", 8, [[128, 100, 0], [256, 150, 5]]); // cheapest variant OOS
const s = mk("s", "Samsung", 12, [[256, 90, 2]]);
const x = mk("x", "Xiaomi", 8, [[128, 50, 0]]); // fully OOS
const c: Product = {
  ...mk("c", "Apple", 0, [[0, 120, 4]]), category: "accessories", specs: undefined, tags: ["iphone 17"],
  variants: [{ sku: "c-0", productId: "c", color: { name: "Noir", hex: "#000000" }, stockQty: 4 }],
};

test("price = cheapest in-stock variant, falls back to cheapest overall", () => {
  assert.equal(fromPrice(a), 150);
  assert.equal(fromPrice(x), 50);
});

test("stock badge thresholds", () => {
  assert.deepEqual([0, 1, 3, 4].map(stockLevel), ["out", "low", "low", "in"]);
});

test("filters combine; sold-out sinks", () => {
  const all = [x, a, s];
  assert.deepEqual(filterProducts(all, { sort: "price-asc" }).map((p) => p.id), ["s", "a", "x"]);
  assert.deepEqual(filterProducts(all, { ram: [8], storage: [256] }).map((p) => p.id), ["a"]);
  assert.deepEqual(filterProducts(all, { brand: ["Samsung", "Xiaomi"], maxPrice: 60 }).map((p) => p.id), ["x"]);
  assert.deepEqual(filterProducts(all, { q: "samsng" }).map((p) => p.id), ["s"]); // fuzzy subsequence
});

test("categories: filter, specs/storage-less products, related stays in category", () => {
  const all = [a, s, c];
  assert.deepEqual(filterProducts(all, { category: "accessories" }).map((p) => p.id), ["c"]);
  assert.deepEqual(filterProducts(all, { ram: [8] }).map((p) => p.id), ["a"]);
  assert.deepEqual(filterProducts(all, { storage: [256] }).map((p) => p.id).sort(), ["a", "s"]);
  assert.deepEqual(filterProducts(all, { q: "iphone 17" }).map((p) => p.id), ["c"]);
  const f = facets(all);
  assert.deepEqual([f.ram, f.storage], [[8, 12], [128, 256]]);
  assert.deepEqual(facets([c]).storage, []);
  assert.deepEqual(relatedProducts(all, a).map((p) => p.id), ["s", "c"]);
  assert.equal(parseFilters({ category: "Bad Slug!" }).category, undefined);
  assert.equal(filtersToQuery(parseFilters({ category: "accessories" })), "?category=accessories");
});

test("category fallback; variants all have storage or none", () => {
  const slugs = ["phones", "accessories"];
  assert.equal(withCategory({ ...a, category: "accessories" }, slugs).category, "accessories");
  assert.equal(withCategory({ ...a, category: "renamed" }, slugs).category, "phones");
  assert.equal(withCategory({ ...a, category: "" }, slugs).category, "phones");
  const legacy = JSON.parse(JSON.stringify(a, (k, v) => (k === "category" || k === "productId" ? undefined : v)));
  assert.equal(productsFileSchema.parse([legacy])[0].category, "");
  const mixed = { ...legacy, variants: [legacy.variants[0], { ...legacy.variants[1], storage: undefined }] };
  assert.equal(productsFileSchema.safeParse([mixed]).success, false);
  const input = productInputSchema.safeParse({ ...mixed, category: "phones", images: ["/x.webp"] });
  assert.ok(!input.success && input.error.issues.some((i) => i.message === "admin.errors.storageMix"));
});

test("editor axis: to and from no storage, each color keeps its SKU and stock", () => {
  const off = { on: false, sku: "" };
  const colorOnly = { [cellKey(0)]: { on: true, sku: "CASE-NO" }, [cellKey(1)]: { on: false, sku: "CASE-BL" } };
  const withStorage = moveAxis(colorOnly, [0, 1], [], [64], off);
  assert.deepEqual([withStorage[cellKey(0, 64)], withStorage[cellKey(1, 64)]], [colorOnly[cellKey(0)], colorOnly[cellKey(1)]]);
  const two = moveAxis(withStorage, [0, 1], [64], [64, 128], off);
  assert.deepEqual([two[cellKey(0, 128)], two[cellKey(0, 64)]], [{ on: true, sku: "" }, colorOnly[cellKey(0)]]);
  const back = moveAxis({ ...two, [cellKey(0, 64)]: { on: true, sku: "CASE-NO-2" } }, [0, 1], [64], [], off);
  assert.deepEqual(back[cellKey(0)], { on: true, sku: "CASE-NO-2" });
  assert.deepEqual(moveAxis({}, [0], [], [128], off)[cellKey(0, 128)], { on: true, sku: "" });
});

test("fuzzy: every token must match", () => {
  assert.ok(fuzzyScore("iphne 17", "Apple iPhone 17 Pro") > 0);
  assert.equal(fuzzyScore("iphone galaxy", "Apple iPhone 17"), 0);
});

test("URL filters round-trip; junk params dropped, not thrown", () => {
  const f = parseFilters({ brand: "Apple,Samsung", ram: "8", sort: "price-asc", minPrice: "abc", condition: "new,broken" });
  assert.deepEqual(f.brand, ["Apple", "Samsung"]);
  assert.equal(f.minPrice, undefined);
  assert.equal(f.condition, undefined);
  assert.equal(filtersToQuery(f), "?brand=Apple%2CSamsung&ram=8&sort=price-asc");
});

test("DZ phone: normalised, invalid rejected", () => {
  assert.equal(dzPhone.parse("+213 555 12 34 56"), "0555123456");
  assert.equal(dzPhone.parse("07.70.12.34.56"), "0770123456");
  assert.equal(dzPhone.safeParse("0412345678").success, false);
  assert.equal(dzPhone.safeParse("055512345").success, false);
});

test("order input: delivery needs wilaya + address; tampered prices stripped", () => {
  const base = { fulfillment: "delivery", name: "Amine", phone: "0555123456", items: [{ sku: "a-1", qty: 1, unitPrice: 1 }] };
  assert.equal(orderInputSchema.safeParse(base).success, false);
  const ok = orderInputSchema.parse({ ...base, wilaya: "16", address: "12 rue X, Alger" });
  assert.deepEqual(ok.items, [{ sku: "a-1", qty: 1 }]);
  assert.equal(orderInputSchema.safeParse({ ...base, fulfillment: "pickup" }).success, true);
  // Stop-desk: a commune is enough, but not nothing.
  assert.equal(orderInputSchema.safeParse({ ...base, fulfillment: "desk", wilaya: "31", address: "Oran" }).success, true);
  assert.equal(orderInputSchema.safeParse({ ...base, fulfillment: "desk", wilaya: "31", address: "" }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...base, wilaya: "31", address: "Oran" }).success, false); // home needs a full address
});

test("deliveryFee: the wilaya's own fee, else the default; desk off → null", () => {
  const defaults = { home: 800, desk: 500 };
  assert.equal(deliveryFee(defaults, {}, false), 800);
  assert.equal(deliveryFee(defaults, { home: 400, desk: 300 }, false), 400);
  assert.equal(deliveryFee(defaults, { home: 400 }, true), 500);
  assert.equal(deliveryFee(defaults, { desk: 300 }, true), 300);
  assert.equal(deliveryFee({ home: 800 }, { desk: 300 }, true), null);
  assert.equal(deliveryFee(defaults, { home: 0 }, false), 0); // free delivery is a fee, not a fallback
});

test("repriceEdit: kept lines keep their price, added ones take the catalog's", () => {
  const catalog = [a, s].flatMap((product) => product.variants.map((variant) => ({ product, variant })));
  const label = (p: Product) => p.name;
  const current = [{ sku: "a-1", qty: 1, unitPrice: 99, label: "old price" }];
  const r = repriceEdit(current, [{ sku: "a-1", qty: 2 }, { sku: "s-0", qty: 1 }], catalog, label);
  assert.deepEqual(r, { ok: true, items: [{ sku: "a-1", qty: 2, unitPrice: 99, label: "old price" }, { sku: "s-0", qty: 1, unitPrice: 90, label: "Samsung s" }] });
  assert.deepEqual(repriceEdit(current, [{ sku: "a-1", qty: 0 }], catalog, label), { ok: false, error: "empty_order" });
  assert.deepEqual(repriceEdit(current, [{ sku: "nope", qty: 1 }], catalog, label), { ok: false, error: "unknown_sku" });
});

test("priceOrder: server prices, merges dup SKUs, refuses OOS/unknown", () => {
  const catalog = [a, s].flatMap((product) => product.variants.map((variant) => ({ product, variant })));
  const label = (p: Product) => p.name;
  const r = priceOrder([{ sku: "a-1", qty: 1 }, { sku: "a-1", qty: 1 }, { sku: "s-0", qty: 1 }], catalog, 800, label);
  assert.ok(r.ok);
  assert.deepEqual(r.totals, { subtotal: 390, deliveryFee: 800, total: 1190 });
  assert.deepEqual(priceOrder([{ sku: "a-0", qty: 1 }], catalog, 0, label), { ok: false, error: "out_of_stock", sku: "a-0" });
  assert.deepEqual(priceOrder([{ sku: "s-0", qty: 3 }], catalog, 0, label), { ok: false, error: "out_of_stock", sku: "s-0" });
  assert.deepEqual(priceOrder([{ sku: "nope", qty: 1 }], catalog, 0, label), { ok: false, error: "unknown_sku", sku: "nope" });
});
