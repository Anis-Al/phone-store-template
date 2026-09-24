// Database CLI (node + type stripping, no build step). Reads .env.local like Next does.
//   npm run db:migrate                                   apply lib/db/migrations/*.sql
//   npm run db:seed                                      import content/products.json + legacy .data/orders.json (idempotent)
//   npm run admin:user -- --username amine --role owner  create a user, or reset its password (prompted)
//   npm run db:backup                                    consistent copy to .data/backups/ (keeps the last 14)
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import type { InStatement } from "@libsql/client";
import { orderSchema, productsFileSchema } from "../lib/data/schemas.ts";
import { migrate, openDb } from "../lib/db/client.ts";
import { hashPassword, MIN_PASSWORD } from "../lib/session.ts";

const [command, ...rest] = process.argv.slice(2);
const db = openDb();

async function seed() {
  await migrate(db);
  const products = productsFileSchema.parse(JSON.parse(await readFile("content/products.json", "utf8")));
  const at = new Date().toISOString();
  const stmts: InStatement[] = products.flatMap((p) => [
    {
      sql: `INSERT OR IGNORE INTO products (id, slug, category, brand, model, name, description, tagline, condition, specs, tags, images,
              base_price, featured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id, p.slug, p.category, p.brand, p.model, p.name, p.description, p.tagline ?? null, p.condition, JSON.stringify(p.specs ?? null),
        JSON.stringify(p.tags), JSON.stringify(p.images), p.basePrice, Number(p.featured), p.createdAt, at,
      ],
    },
    ...p.variants.map((v, i) => ({
      sql: `INSERT OR IGNORE INTO variants (sku, product_id, color_name, color_hex, storage, price_override, stock_qty, images, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [v.sku, p.id, v.color.name, v.color.hex, v.storage ?? null, v.priceOverride ?? null, v.stockQty, v.images ? JSON.stringify(v.images) : null, i],
    })),
  ]);

  const legacy = process.env.ORDERS_FILE || ".data/orders.json";
  const orders = existsSync(legacy) ? orderSchema.array().parse(JSON.parse(await readFile(legacy, "utf8"))) : [];
  for (const o of orders) {
    stmts.push(
      {
        sql: `INSERT OR IGNORE INTO orders (id, seq, status, fulfillment, payment_method, customer, subtotal, delivery_fee, total, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          o.id, Number(o.id.split("-").at(-1)), o.status, o.fulfillment, o.paymentMethod, JSON.stringify(o.customer),
          o.totals.subtotal, o.totals.deliveryFee, o.totals.total, o.createdAt, o.createdAt,
        ],
      },
      ...o.items.map((i) => ({
        sql: "INSERT OR IGNORE INTO order_items (order_id, sku, qty, unit_price, label) VALUES (?, ?, ?, ?, ?)",
        args: [o.id, i.sku, i.qty, i.unitPrice, i.label],
      })),
    );
  }
  const rs = await db.batch(stmts, "write");
  const added = rs.reduce((n, r) => n + r.rowsAffected, 0);
  console.log(`seed: ${products.length} products, ${orders.length} legacy orders read; ${added} new rows written.`);
}

async function askPassword(prompt: string) {
  if (!process.stdin.isTTY) {
    // Piped input (scripts / CI): first line of stdin.
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) return line;
    return "";
  }
  let muted = false;
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output: mutableStdout, terminal: true });
  process.stdout.write(prompt);
  muted = true;
  const answer = await rl.question("");
  muted = false;
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function user() {
  const { values } = parseArgs({
    args: rest,
    options: { username: { type: "string" }, role: { type: "string", default: "owner" }, name: { type: "string" } },
  });
  const username = values.username?.trim() ?? "";
  if (!/^[\w.-]{2,32}$/.test(username) || !["owner", "staff"].includes(values.role!)) {
    throw new Error("usage: npm run admin:user -- --username <name> [--role owner|staff] [--name \"Full name\"]");
  }
  await migrate(db);
  const password = await askPassword(`Password for ${username} (min ${MIN_PASSWORD} chars): `);
  if (password.length < MIN_PASSWORD) throw new Error(`password too short (min ${MIN_PASSWORD})`);
  const hash = await hashPassword(password);
  const existing = await db.execute({ sql: "SELECT id FROM users WHERE username = ?", args: [username] });
  if (existing.rows.length) {
    // Reset: new password + role, re-enabled, logged out everywhere.
    await db.execute({
      sql: `UPDATE users SET password_hash = ?, role = ?, disabled_at = NULL, session_version = session_version + 1 WHERE username = ?`,
      args: [hash, values.role!, username],
    });
    console.log(`user ${username}: password reset (${values.role}).`);
  } else {
    await db.execute({
      sql: "INSERT INTO users (username, name, role, password_hash) VALUES (?, ?, ?, ?)",
      args: [username, values.name ?? username, values.role!, hash],
    });
    console.log(`user ${username} created (${values.role}).`);
  }
}

async function backup() {
  const url = process.env.DATABASE_URL || "file:.data/store.db";
  if (!url.startsWith("file:")) throw new Error("backup: remote database, use the provider's point-in-time restore");
  const dir = path.join(path.dirname(url.slice(5)), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `store-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await db.execute({ sql: "VACUUM INTO ?", args: [file] }); // consistent snapshot while the server keeps writing
  const old = (await readdir(dir)).filter((f) => /^store-.*\.db$/.test(f)).sort().slice(0, -14);
  await Promise.all(old.map((f) => rm(path.join(dir, f))));
  console.log(`backup: ${file}`);
}

const commands: Record<string, () => Promise<unknown>> = {
  migrate: async () => console.log(`migrate: ${(await migrate(db)).join(", ") || "up to date"}`),
  seed,
  user,
  backup,
};

try {
  if (!commands[command]) throw new Error(`unknown command "${command ?? ""}" (migrate | seed | user | backup)`);
  await commands[command]();
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  db.close();
}
