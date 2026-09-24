import { randomUUID } from "node:crypto";
import { LibsqlBatchError, type Client, type InArgs, type InStatement, type Row } from "@libsql/client";
import { filterProducts, fuzzyScore, withCategory } from "../../catalog.ts";
import { canTransition, OutOfStockError } from "../../order.ts";
import type { AdminProduct, AdminRepository, AdminUser, OrderQuery, StockReason, VariantRow } from "../repository";
import { ORDER_STATUSES, orderSchema, productSchema, type Order, type OrderStatus } from "../schemas.ts";

// Plain-Node importable (tests): runtime imports are relative .ts files, zod and @libsql/client only.
//
// Concurrency: every write is ONE `db.batch()`. On a file database the libsql binding runs a batch
// synchronously, so batches never interleave inside the Node process, and SQLite's write lock
// serialises them across processes. Conditions that must hold at write time live in the SQL
// (the stock_qty >= 0 CHECK, `WHERE status = :from`), never in a read done earlier.

const LOW_STOCK = 3;
const PAID = "('confirmed','ready','done')"; // statuses that count as revenue

const json = (v: unknown) => (v == null ? undefined : JSON.parse(String(v)));
const str = (v: unknown) => (v == null ? null : String(v));
const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function toProduct(p: Row, variants: Row[]): AdminProduct {
  const product = productSchema.parse({
    id: p.id,
    slug: p.slug,
    category: p.category,
    brand: p.brand,
    model: p.model,
    name: p.name,
    description: p.description,
    tagline: p.tagline ?? undefined,
    images: json(p.images),
    basePrice: p.base_price,
    condition: p.condition,
    specs: json(p.specs) ?? undefined,
    tags: json(p.tags),
    featured: Boolean(p.featured),
    createdAt: p.created_at,
    variants: variants.map((v) => ({
      sku: v.sku,
      productId: v.product_id,
      color: { name: v.color_name, hex: v.color_hex },
      storage: v.storage ?? undefined,
      priceOverride: v.price_override ?? undefined,
      stockQty: v.stock_qty,
      images: json(v.images),
    })),
  });
  return { ...product, archivedAt: str(p.archived_at), updatedAt: String(p.updated_at) };
}

function toOrder(o: Row, items: Row[]): Order {
  return orderSchema.parse({
    id: o.id,
    items: items.map((i) => ({ sku: i.sku, qty: i.qty, unitPrice: i.unit_price, label: i.label })),
    fulfillment: o.fulfillment,
    customer: json(o.customer),
    paymentMethod: o.payment_method,
    status: o.status,
    totals: { subtotal: o.subtotal, deliveryFee: o.delivery_fee, total: o.total },
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    note: o.note ?? undefined,
  });
}

const toUser = (u: Row): AdminUser => ({
  id: Number(u.id),
  username: String(u.username),
  name: String(u.name),
  role: u.role === "owner" ? "owner" : "staff",
  sessionVersion: Number(u.session_version),
  disabledAt: str(u.disabled_at),
});

const toVariantRow = (r: Row): VariantRow => ({
  sku: String(r.sku),
  productId: String(r.product_id),
  product: String(r.product),
  color: String(r.color_name),
  storage: r.storage == null ? null : Number(r.storage),
  price: Number(r.price),
  stock: Number(r.stock_qty),
});

const auditStmt = (by: number | null, action: string, entity: string, id: string, diff?: unknown): InStatement => ({
  sql: "INSERT INTO audit (user_id, action, entity, entity_id, diff, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  args: [by, action, entity, id, diff === undefined ? null : JSON.stringify(diff), now()],
});

const isCheckFailure = (e: unknown): e is LibsqlBatchError =>
  e instanceof LibsqlBatchError && /CHECK constraint failed/i.test(e.message);

export function createDbAdapter(db: Client, orderPrefix: string, categories: readonly string[]): AdminRepository {
  /** Products (with variants) matching a WHERE clause on `products`. */
  async function loadProducts(where = "archived_at IS NULL", args: InArgs = []): Promise<AdminProduct[]> {
    const [ps, vs] = await db.batch(
      [
        { sql: `SELECT * FROM products WHERE ${where} ORDER BY created_at DESC, id`, args },
        {
          sql: `SELECT * FROM variants WHERE product_id IN (SELECT id FROM products WHERE ${where}) ORDER BY position, sku`,
          args,
        },
      ],
      "read",
    );
    const byProduct = Map.groupBy(vs.rows, (v) => String(v.product_id));
    return ps.rows.map((p) => withCategory(toProduct(p, byProduct.get(String(p.id)) ?? []), categories));
  }

  async function loadOrders(rows: Row[]): Promise<Order[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => String(r.id));
    const items = await db.execute({
      sql: `SELECT * FROM order_items WHERE order_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid`,
      args: ids,
    });
    const byOrder = Map.groupBy(items.rows, (i) => String(i.order_id));
    return rows.map((o) => toOrder(o, byOrder.get(String(o.id)) ?? []));
  }

  const variantRows = (where = "", args: InArgs = []) =>
    db.execute({
      sql: `SELECT v.sku, v.product_id, p.name AS product, v.color_name, v.storage, v.stock_qty,
              COALESCE(v.price_override, p.base_price) AS price
            FROM variants v JOIN products p ON p.id = v.product_id ${where}
            ORDER BY p.name, v.position, v.sku`,
      args,
    });

  const api: AdminRepository = {
    // ---- storefront (Repository) ----

    // ponytail: loads the whole live catalog per call and filters in JS (same code as the local
    // adapter, so the storefront behaves identically). Move filters into SQL past ~2,000 products.
    getProducts: async (filters = {}) => filterProducts(await loadProducts(), filters),

    getProductBySlug: async (slug) => (await loadProducts("archived_at IS NULL AND slug = ?", [slug]))[0] ?? null,

    getBrands: async () =>
      (await db.execute("SELECT DISTINCT brand FROM products WHERE archived_at IS NULL ORDER BY brand")).rows.map((r) =>
        String(r.brand),
      ),

    getVariants: async (skus) => {
      if (!skus.length) return [];
      const marks = skus.map(() => "?").join(",");
      const products = await loadProducts(
        `archived_at IS NULL AND id IN (SELECT product_id FROM variants WHERE sku IN (${marks}))`,
        skus,
      );
      return products.flatMap((product) =>
        product.variants.filter((v) => skus.includes(v.sku)).map((variant) => ({ product, variant })),
      );
    },

    async createOrder(draft) {
      const at = now();
      // The batch is a write transaction, so MAX(seq) is the row this batch just inserted.
      const current = "(SELECT id FROM orders WHERE seq = (SELECT MAX(seq) FROM orders))";
      const stmts: InStatement[] = [
        {
          sql: `INSERT INTO orders (id, seq, status, fulfillment, payment_method, customer, subtotal, delivery_fee, total, created_at, updated_at)
                SELECT ? || '-' || s, s, 'new', ?, ?, ?, ?, ?, ?, ?, ? FROM (SELECT COALESCE(MAX(seq), 1000) + 1 AS s FROM orders)`,
          args: [
            orderPrefix, draft.fulfillment, draft.paymentMethod, JSON.stringify(draft.customer),
            draft.totals.subtotal, draft.totals.deliveryFee, draft.totals.total, at, at,
          ],
        },
        ...draft.items.flatMap((i): InStatement[] => [
          {
            sql: `INSERT INTO order_items (order_id, sku, qty, unit_price, label) VALUES (${current}, ?, ?, ?, ?)`,
            args: [i.sku, i.qty, i.unitPrice, i.label],
          },
          // Reservation. Going below 0 violates the CHECK and rolls the whole order back.
          // ponytail: a variant deleted between pricing and this batch is not caught (0 rows updated);
          // the order still lands and staff sees it when calling the customer.
          { sql: "UPDATE variants SET stock_qty = stock_qty - ? WHERE sku = ?", args: [i.qty, i.sku] },
          {
            sql: `INSERT INTO stock_movements (sku, delta, reason, order_id, created_at) VALUES (?, ?, 'order', ${current}, ?)`,
            args: [i.sku, -i.qty, at],
          },
        ]),
        `SELECT id FROM orders WHERE seq = (SELECT MAX(seq) FROM orders)`,
      ];
      try {
        const rs = await db.batch(stmts, "write");
        return { ...draft, id: String(rs.at(-1)!.rows[0].id), status: "new", createdAt: at, updatedAt: at };
      } catch (e) {
        if (isCheckFailure(e)) throw new OutOfStockError(draft.items[Math.floor((e.statementIndex - 1) / 3)]?.sku ?? "");
        throw e;
      }
    },

    // ---- admin: products & stock ----

    async listProducts(q) {
      const where = [q.archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"];
      const args: string[] = [];
      if (q.brand) {
        where.push("brand = ?");
        args.push(q.brand);
      }
      if (q.condition) {
        where.push("condition = ?");
        args.push(q.condition);
      }
      let rows = await loadProducts(where.join(" AND "), args);
      if (q.category) rows = rows.filter((p) => p.category === q.category);
      if (q.lowStock) rows = rows.filter((p) => p.variants.some((v) => v.stockQty <= LOW_STOCK));
      if (q.search) {
        const text = (p: AdminProduct) => [p.brand, p.name, p.model, ...p.variants.map((v) => v.sku)].join(" ");
        rows = rows.filter((p) => fuzzyScore(q.search!, text(p)) > 0);
      }
      return rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
    },

    getProduct: async (id) => (await loadProducts("id = ?", [id]))[0] ?? null,

    async saveProduct(input, by) {
      const before = input.id ? await api.getProduct(input.id) : null;
      if (input.id && !before) throw new Error("not_found");
      const id = before?.id ?? `p-${randomUUID().slice(0, 8)}`;
      const at = now();
      const kept = new Set(input.variants.map((v) => v.prevSku).filter(Boolean));
      const renamed = input.variants.filter((v) => v.prevSku && v.prevSku !== v.sku).map((v) => v.prevSku!);
      if (renamed.length) {
        const sold = await db.execute({
          sql: `SELECT 1 FROM order_items WHERE sku IN (${renamed.map(() => "?").join(",")}) LIMIT 1`,
          args: renamed,
        });
        if (sold.rows.length) throw new Error("sku_locked"); // SKUs freeze once ordered
      }

      const fields = [
        input.category, input.brand, input.model, input.name, input.description, input.tagline || null, input.condition,
        JSON.stringify(input.specs ?? null), JSON.stringify(input.tags), JSON.stringify(input.images),
        input.basePrice, Number(input.featured),
      ];
      const stmts: InStatement[] = [
        before
          ? {
              // slug is not updated: it's locked after the first save (links and rankings depend on it).
              sql: `UPDATE products SET category = ?, brand = ?, model = ?, name = ?, description = ?, tagline = ?, condition = ?,
                      specs = ?, tags = ?, images = ?, base_price = ?, featured = ?, updated_at = ? WHERE id = ?`,
              args: [...fields, at, id],
            }
          : {
              sql: `INSERT INTO products (category, brand, model, name, description, tagline, condition, specs, tags, images,
                      base_price, featured, updated_at, id, slug, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [...fields, at, id, input.slug, at.slice(0, 10)],
            },
      ];

      for (const v of before?.variants ?? []) {
        if (kept.has(v.sku)) continue; // switched off in the matrix → removed; order history keeps its labels
        stmts.push(
          {
            sql: `INSERT INTO stock_movements (sku, delta, reason, user_id, created_at)
                  SELECT sku, -stock_qty, 'edit', ?, ? FROM variants WHERE sku = ? AND stock_qty > 0`,
            args: [by, at, v.sku],
          },
          { sql: "DELETE FROM variants WHERE sku = ? AND product_id = ?", args: [v.sku, id] },
        );
      }

      input.variants.forEach((v, position) => {
        const cols = [v.color.name, v.color.hex, v.storage ?? null, v.priceOverride ?? null, v.images ? JSON.stringify(v.images) : null, position];
        if (v.prevSku && before?.variants.some((b) => b.sku === v.prevSku)) {
          if (v.prevSku !== v.sku) {
            stmts.push(
              { sql: "UPDATE variants SET sku = ? WHERE sku = ?", args: [v.sku, v.prevSku] },
              { sql: "UPDATE stock_movements SET sku = ? WHERE sku = ?", args: [v.sku, v.prevSku] },
            );
          }
          // Stock is applied as a delta from what the editor loaded, so orders placed meanwhile still count.
          const delta = v.stockQty - (v.stockWas ?? v.stockQty);
          if (delta) {
            stmts.push({
              sql: "INSERT INTO stock_movements (sku, delta, reason, user_id, created_at) VALUES (?, ?, 'edit', ?, ?)",
              args: [v.sku, delta, by, at],
            });
          }
          stmts.push({
            sql: `UPDATE variants SET color_name = ?, color_hex = ?, storage = ?, price_override = ?, images = ?, position = ?,
                    stock_qty = stock_qty + ? WHERE sku = ?`,
            args: [...cols, delta, v.sku],
          });
        } else {
          stmts.push({
            sql: `INSERT INTO variants (color_name, color_hex, storage, price_override, images, position, stock_qty, sku, product_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [...cols, v.stockQty, v.sku, id],
          });
          if (v.stockQty) {
            stmts.push({
              sql: "INSERT INTO stock_movements (sku, delta, reason, user_id, created_at) VALUES (?, ?, 'edit', ?, ?)",
              args: [v.sku, v.stockQty, by, at],
            });
          }
        }
      });

      const diff = before
        ? Object.fromEntries(
            (["name", "category", "brand", "model", "basePrice", "condition", "featured", "tagline", "description"] as const)
              .filter((k) => before[k] !== input[k])
              .map((k) => [k, [before[k], input[k]]]),
          )
        : { name: input.name };
      stmts.push(auditStmt(by, before ? "update" : "create", "product", id, diff));

      try {
        await db.batch(stmts, "write");
      } catch (e) {
        if (isCheckFailure(e)) throw new Error("stock_changed");
        if (e instanceof LibsqlBatchError && /UNIQUE/i.test(e.message)) throw new Error(/slug/.test(e.message) ? "slug_taken" : "sku_taken");
        throw e;
      }
      return (await api.getProduct(id))!;
    },

    async setArchived(id, archived, by) {
      await db.batch(
        [
          { sql: "UPDATE products SET archived_at = ?, updated_at = ? WHERE id = ?", args: [archived ? now() : null, now(), id] },
          auditStmt(by, archived ? "archive" : "restore", "product", id),
        ],
        "write",
      );
    },

    async updateVariants(changes, reason, by, note) {
      const at = now();
      const stmts: InStatement[] = changes.flatMap(({ sku, price, stock }): InStatement[] => [
        ...(price !== undefined ? [{ sql: "UPDATE variants SET price_override = ? WHERE sku = ?", args: [price, sku] }] : []),
        ...(stock
          ? "set" in stock
            ? [
                {
                  sql: `INSERT INTO stock_movements (sku, delta, reason, note, user_id, created_at)
                        SELECT sku, ? - stock_qty, ?, ?, ?, ? FROM variants WHERE sku = ? AND stock_qty <> ?`,
                  args: [stock.set, reason, note ?? null, by, at, sku, stock.set],
                },
                { sql: "UPDATE variants SET stock_qty = ? WHERE sku = ?", args: [stock.set, sku] },
              ]
            : stock.delta
              ? [
                  {
                    sql: `INSERT INTO stock_movements (sku, delta, reason, note, user_id, created_at)
                          SELECT sku, ?, ?, ?, ?, ? FROM variants WHERE sku = ?`,
                    args: [stock.delta, reason, note ?? null, by, at, sku],
                  },
                  { sql: "UPDATE variants SET stock_qty = stock_qty + ? WHERE sku = ?", args: [stock.delta, sku] },
                ]
              : []
          : []),
      ]);
      if (!stmts.length) return;
      const target = changes.length === 1 ? changes[0].sku : `${changes.length} SKU`;
      stmts.push(auditStmt(by, reason, "variant", target, changes.length > 20 ? { count: changes.length } : changes));
      try {
        await db.batch(stmts, "write");
      } catch (e) {
        if (isCheckFailure(e)) throw new Error("negative_stock");
        throw e;
      }
    },

    listVariants: async () => (await variantRows("WHERE p.archived_at IS NULL")).rows.map(toVariantRow),

    // ---- admin: orders ----

    async listOrders(q: OrderQuery) {
      const size = q.pageSize;
      const offset = (Math.max(1, Math.floor(q.page) || 1) - 1) * size;
      const where = ["1 = 1"];
      const args: Record<string, string | number> = {};
      if (q.status) {
        where.push("status = :status");
        args.status = q.status;
      }
      const s = q.search?.trim();
      if (s) {
        const digits = s.replace(/\D/g, "");
        where.push(
          `(id LIKE :like OR json_extract(customer, '$.name') LIKE :like${digits.length >= 3 ? " OR json_extract(customer, '$.phone') LIKE :digits" : ""})`,
        );
        args.like = `%${s}%`;
        if (digits.length >= 3) args.digits = `%${digits}%`;
      }
      // Dates are the store's calendar days, read in the server's time zone (set TZ=Africa/Algiers).
      if (q.from) {
        where.push("created_at >= :from");
        args.from = new Date(`${q.from}T00:00:00`).toISOString();
      }
      if (q.to) {
        where.push("created_at < :to");
        args.to = new Date(new Date(`${q.to}T00:00:00`).getTime() + 86_400_000).toISOString();
      }
      const filter = where.join(" AND ");
      const [rows, total, counts] = await db.batch(
        [
          { sql: `SELECT * FROM orders WHERE ${filter} ORDER BY seq DESC LIMIT ${size} OFFSET ${offset}`, args },
          { sql: `SELECT COUNT(*) AS n FROM orders WHERE ${filter}`, args },
          "SELECT status, COUNT(*) AS n FROM orders GROUP BY status",
        ],
        "read",
      );
      return {
        rows: await loadOrders(rows.rows),
        total: Number(total.rows[0].n),
        counts: Object.fromEntries(
          ORDER_STATUSES.map((st) => [st, Number(counts.rows.find((r) => r.status === st)?.n ?? 0)]),
        ) as Record<OrderStatus, number>,
      };
    },

    getOrder: async (id) => (await loadOrders((await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [id] })).rows))[0] ?? null,

    async setOrderStatus(id, next, by, note) {
      const order = await api.getOrder(id);
      if (!order) throw new Error("not_found");
      if (!canTransition(order.status, next)) throw new Error("invalid_transition");
      const args = { id, from: order.status, next, by, at: now(), diff: JSON.stringify({ from: order.status, to: next, note }) };
      const still = "EXISTS (SELECT 1 FROM orders WHERE id = :id AND status = :from)"; // no-op if someone else moved it first
      const stmts: InStatement[] = [];
      if (next === "cancelled") {
        // Give back exactly what this order reserved (its `order` movements). Guarded by `still`,
        // so a double-click or a second tab can't restore twice.
        stmts.push(
          {
            sql: `UPDATE variants SET stock_qty = stock_qty + (SELECT -SUM(m.delta) FROM stock_movements m
                    WHERE m.order_id = :id AND m.reason = 'order' AND m.sku = variants.sku)
                  WHERE sku IN (SELECT sku FROM stock_movements WHERE order_id = :id AND reason = 'order') AND ${still}`,
            args,
          },
          {
            sql: `INSERT INTO stock_movements (sku, delta, reason, order_id, user_id, created_at)
                  SELECT sku, -SUM(delta), 'cancel', :id, :by, :at FROM stock_movements
                  WHERE order_id = :id AND reason = 'order' AND ${still} GROUP BY sku`,
            args,
          },
        );
      }
      stmts.push(
        {
          sql: `INSERT INTO audit (user_id, action, entity, entity_id, diff, created_at)
                SELECT :by, 'status', 'order', :id, :diff, :at WHERE ${still}`,
          args,
        },
        { sql: "UPDATE orders SET status = :next, updated_at = :at WHERE id = :id AND status = :from", args },
      );
      const rs = await db.batch(stmts, "write");
      if (rs.at(-1)!.rowsAffected !== 1) throw new Error("conflict");
    },

    async setOrderNote(id, note, by) {
      await db.batch(
        [
          { sql: "UPDATE orders SET note = ?, updated_at = ? WHERE id = ?", args: [note || null, now(), id] },
          auditStmt(by, "note", "order", id, { note }),
        ],
        "write",
      );
    },

    async audit(entity, entityId) {
      const rs = await db.execute({
        sql: `SELECT a.id, a.action, a.diff, a.created_at, u.name AS user_name FROM audit a
              LEFT JOIN users u ON u.id = a.user_id WHERE a.entity = ? AND a.entity_id = ? ORDER BY a.id`,
        args: [entity, entityId],
      });
      return rs.rows.map((r) => ({
        id: Number(r.id),
        action: String(r.action),
        userName: str(r.user_name),
        diff: json(r.diff),
        createdAt: String(r.created_at),
      }));
    },

    async stockMovements(q) {
      const where = ["1 = 1"];
      const args: string[] = [];
      if (q.sku) {
        where.push("m.sku LIKE ?");
        args.push(`%${q.sku}%`);
      }
      if (q.reason) {
        where.push("m.reason = ?");
        args.push(q.reason);
      }
      const filter = where.join(" AND ");
      const [rows, total] = await db.batch(
        [
          {
            sql: `SELECT m.*, u.name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
                  WHERE ${filter} ORDER BY m.id DESC LIMIT ${q.pageSize} OFFSET ${(Math.max(1, Math.floor(q.page) || 1) - 1) * q.pageSize}`,
            args,
          },
          { sql: `SELECT COUNT(*) AS n FROM stock_movements m WHERE ${filter}`, args },
        ],
        "read",
      );
      return {
        total: Number(total.rows[0].n),
        rows: rows.rows.map((r) => ({
          id: Number(r.id),
          sku: String(r.sku),
          delta: Number(r.delta),
          reason: r.reason as StockReason,
          note: str(r.note),
          orderId: str(r.order_id),
          userName: str(r.user_name),
          createdAt: String(r.created_at),
        })),
      };
    },

    async dashboard() {
      const [todo, low, d7, d30, top] = await db.batch(
        [
          "SELECT SUM(status = 'new') AS n, SUM(status = 'ready') AS r FROM orders",
          {
            sql: `SELECT v.sku, v.product_id, p.name AS product, v.color_name, v.storage, v.stock_qty,
                    COALESCE(v.price_override, p.base_price) AS price
                  FROM variants v JOIN products p ON p.id = v.product_id
                  WHERE p.archived_at IS NULL AND v.stock_qty <= ? ORDER BY v.stock_qty, p.name LIMIT 20`,
            args: [LOW_STOCK],
          },
          { sql: `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS t FROM orders WHERE status IN ${PAID} AND created_at >= ?`, args: [daysAgo(7)] },
          { sql: `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS t FROM orders WHERE status IN ${PAID} AND created_at >= ?`, args: [daysAgo(30)] },
          {
            sql: `SELECT i.sku, MAX(i.label) AS label, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS revenue
                  FROM order_items i JOIN orders o ON o.id = i.order_id
                  WHERE o.status IN ${PAID} AND o.created_at >= ? GROUP BY i.sku ORDER BY qty DESC, revenue DESC LIMIT 5`,
            args: [daysAgo(30)],
          },
        ],
        "read",
      );
      const n = (v: unknown) => Number(v ?? 0);
      return {
        newOrders: n(todo.rows[0].n),
        readyOrders: n(todo.rows[0].r),
        lowStock: low.rows.map(toVariantRow),
        last7: { orders: n(d7.rows[0].n), revenue: n(d7.rows[0].t) },
        last30: { orders: n(d30.rows[0].n), revenue: n(d30.rows[0].t) },
        topSkus: top.rows.map((r) => ({ sku: String(r.sku), label: String(r.label), qty: n(r.qty), revenue: n(r.revenue) })),
      };
    },

    // ---- admin: users ----

    async findUser(username) {
      const r = (await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username.trim()] })).rows[0];
      return r ? { ...toUser(r), passwordHash: String(r.password_hash) } : null;
    },

    async getUser(id) {
      const r = (await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] })).rows[0];
      return r ? toUser(r) : null;
    },

    listUsers: async () => (await db.execute("SELECT * FROM users ORDER BY role, username")).rows.map(toUser),

    async createUser(u, by) {
      const [ins] = await db.batch(
        [
          {
            sql: "INSERT INTO users (username, name, role, password_hash) VALUES (?, ?, ?, ?)",
            args: [u.username.trim(), u.name.trim(), u.role, u.passwordHash],
          },
          auditStmt(by, "create", "user", u.username.trim(), { role: u.role }),
        ],
        "write",
      );
      return Number(ins.lastInsertRowid);
    },

    async updateUser(id, change, by) {
      const sets: string[] = [];
      const args: (string | number | null)[] = [];
      if (change.passwordHash) {
        sets.push("password_hash = ?");
        args.push(change.passwordHash);
      }
      if (change.role) {
        sets.push("role = ?");
        args.push(change.role);
      }
      if (change.disabled !== undefined) {
        sets.push("disabled_at = ?");
        args.push(change.disabled ? now() : null);
      }
      if (change.passwordHash || change.disabled) sets.push("session_version = session_version + 1");
      if (!sets.length) return;
      await db.batch(
        [
          { sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args: [...args, id] },
          auditStmt(by, "update", "user", String(id), { ...change, passwordHash: change.passwordHash ? "***" : undefined }),
        ],
        "write",
      );
    },
  };
  return api;
}
