# Admin Panel — Implementation Plan

> **Status (September 2026):** A0–A5 and A7 are built; A6 (runtime settings) is not. See CHANGELOG.md.
> Deviations: photos are local-disk only (no S3 driver yet); login errors are shown on the page, not as HTTP 429.

Extension of the phone-store template. Feed it to the coding agent phase by phase, pasting Section 1 with every phase.

## 0. Feasibility

**Yes, it's possible.** The seam already exists: every page reads through the `Repository` interface (`lib/data/repository.ts`), orders are already written through it, and `/admin/orders` plus auth are already in place.

**One prerequisite:** the catalog is `content/products.json`, imported at build time, so editing it needs a runtime database.
Rewriting the JSON file at runtime doesn't work: Vercel's filesystem is read-only, and a JSON file has no transactions, so concurrent orders and edits lose writes. Phase A1 therefore swaps in a database adapter, and the storefront doesn't change.

## 1. Global rules (every phase)

- **Mutations are Server Actions only.** Each one runs, in order: `requireRole()` → Zod parse (reuse `lib/data/schemas.ts`) → a repository write in **one transaction** → an audit row → `revalidatePath`. Prices, stock and roles sent by the client are never trusted.
- **Check authorization in every action and route handler**, not only in `proxy.ts`. Server Actions are public POST endpoints.
- **Same tokens and `components/ui`.** No separate admin theme. Build for 375 px first, because shop owners run the store from a phone.
- Every string lives in the locale files under `admin.*`.
- The storefront never imports admin code. The admin lives in `app/admin/` with its own layout and is `noindex`.
- No ORM and no UI kit. The only new dependency is `@libsql/client`. `sharp` is already installed with Next.
- **Soft delete only (archive).** Orders keep a label and price snapshot, so history never breaks.
- Each phase ends with a typecheck, lint, `npm test`, a self-check of its acceptance criteria and a CHANGELOG entry. Storefront Phase 1–5 checks must still pass.

## 2. Stack additions

| Need | Choice | Why |
| --- | --- | --- |
| Database | libSQL via `@libsql/client` | One client, two modes: `file:.data/store.db` on a Node host, `libsql://…turso.io` on Vercel/serverless. `node:sqlite` is still experimental in Node 24; `better-sqlite3` needs a native build and has no serverless path. |
| Migrations | plain `.sql` files + a 30-line runner | Keeps the "no ORM" rule; applied files are recorded in `_migrations`. |
| Auth | `node:crypto` scrypt + HMAC-signed cookie | No auth library needed for 1–5 staff accounts. |
| Media | `lib/media.ts`: `local` (disk + `/media/*` route) or `s3` (R2 / Vercel Blob) | Files written to `public/` after the build are **not** served by `next start`. |
| CSV | hand-written | Import format is `sku,price,stock` (no quoting needed); export quotes every field. |

## 3. Structure and contracts

```
/app/admin/login                  public login page
/app/admin/(panel)/layout.tsx     session gate + nav (bottom tabs on mobile, sidebar on desktop)
/app/admin/(panel)/page.tsx       dashboard
/app/admin/(panel)/orders         list + [id] detail          (+ actions.ts)
/app/admin/(panel)/products       list + new + [id] editor    (+ actions.ts)
/app/admin/(panel)/stock          movements + CSV import/export
/app/admin/(panel)/users          owner only
/app/media/[...path]/route.ts     serves uploads (local media driver)
/lib/db/client.ts, /lib/db/migrations/*.sql
/lib/data/adapters/db.ts          Repository + AdminRepository on libSQL
/lib/auth.ts                      hashPassword, verifyPassword, signSession, requireRole
/lib/media.ts                     put / remove / url; sharp → webp
/scripts/db-migrate.mjs, db-seed.mjs, admin-user.mjs
```

```ts
interface AdminRepository extends Repository {
  listProducts(q: { search?: string; brand?: string; archived?: boolean; lowStock?: boolean }): Promise<Product[]>;
  saveProduct(input: ProductInput, by: UserId): Promise<Product>; // tx: product + variants + movements + audit
  setArchived(id: string, archived: boolean, by: UserId): Promise<void>;
  adjustStock(sku: string, change: { delta: number } | { set: number }, reason: string, by: UserId): Promise<void>;
  listOrders(q: { status?: OrderStatus; search?: string; from?: string; to?: string; page: number }): Promise<{ rows: Order[]; total: number }>;
  getOrder(id: string): Promise<Order | null>;
  setOrderStatus(id: string, next: OrderStatus, by: UserId, note?: string): Promise<Order>; // state machine
  stockMovements(q: { sku?: string; page: number }): Promise<StockMovement[]>;
}
```

New env vars: `DATA_ADAPTER=local|db`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET` (≥ 32 random bytes), `MEDIA_DRIVER=local|s3`, `UPLOAD_DIR`, `S3_ENDPOINT` / `S3_BUCKET` / `S3_KEY` / `S3_SECRET` / `S3_PUBLIC_URL`. `ADMIN_PASSWORD` is removed in A2.

## 4. Data model (SQL)

```sql
products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, brand, model, name, description, tagline,
          condition TEXT CHECK (condition IN ('new','used')), specs JSON, tags JSON, images JSON,
          base_price INTEGER NOT NULL, featured INTEGER DEFAULT 0,
          created_at, updated_at, archived_at)
variants (sku TEXT PRIMARY KEY, product_id REFERENCES products(id), color_name, color_hex,
          storage INTEGER, price_override INTEGER, stock_qty INTEGER NOT NULL CHECK (stock_qty >= 0),
          images JSON, position INTEGER)
orders   (id TEXT PRIMARY KEY /* MS-1042 */, seq INTEGER UNIQUE, status, fulfillment, payment_method,
          customer JSON, subtotal INTEGER, delivery_fee INTEGER, total INTEGER, note, created_at, updated_at)
order_items     (order_id REFERENCES orders(id), sku, qty INTEGER, unit_price INTEGER, label)
stock_movements (id INTEGER PRIMARY KEY, sku, delta INTEGER,
                 reason TEXT CHECK (reason IN ('order','cancel','manual','import','edit')),
                 order_id, user_id, created_at)
users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, name, role TEXT CHECK (role IN ('owner','staff')),
       password_hash, session_version INTEGER DEFAULT 1, disabled_at)
audit (id INTEGER PRIMARY KEY, user_id, action, entity, entity_id, diff JSON, created_at)
```

Rules:
- **Stock reservation is race-safe:** `UPDATE variants SET stock_qty = stock_qty - :n WHERE sku = :sku AND stock_qty >= :n`. Zero rows affected means `out_of_stock`, and the whole order rolls back.
- **Order status machine:** `new → confirmed | cancelled`, `confirmed → ready | cancelled`, `ready → done | cancelled`. `done` and `cancelled` are final. Cancelling restores stock once, as a `cancel` movement.
- **Roles:** `owner` can do everything. `staff` can manage orders and adjust stock, but can't touch prices, products or users.

## 5. Phases

### A0 — Decisions (no code) · S
- Hosting: **Node host** (file DB, local media) or **Vercel** (Turso + R2/Blob).
- When stock moves: **reserve when the order is created** (default; prevents overselling, but fake COD orders hold stock until cancelled) or decrement on confirmation.
- **Accept:** decisions written into TEMPLATE_SETUP.md for this client.

### A1 — Database adapter · M
- `@libsql/client`, `npm run db:migrate` (runs `lib/db/migrations/*.sql` in order and records them in `_migrations`).
- The `db` adapter implements the existing `Repository` one-to-one. Rows map to `Product` through `productSchema.parse`, so bad rows fail loudly.
- `npm run db:seed` imports `content/products.json` and the legacy `.data/orders.json`, idempotently.
- `DATA_ADAPTER=local|db` switch in `repository.ts`. `local` stays the default for demos.
- `createOrder` inserts the order and its items and reserves stock in one transaction; the ref comes from `seq`.
- **Accept:** the storefront is identical on `db` (all Phase 1–5 checks pass, product pages still prebuilt); 20 parallel orders on a SKU with stock 3 → exactly 3 succeed; running the seed twice changes nothing.

### A2 — Auth + admin shell · M
- `npm run admin:user -- --username amine --role owner` prompts for a password and stores a scrypt hash.
- `/admin/login`: a Server Action checks username and password, rate-limited to 5 attempts per 15 min per IP and username, with one generic error message.
- Session cookie `adm` = `userId.expires.sessionVersion.hmac` with `HttpOnly; Secure; SameSite=Lax; Path=/admin`, valid 7 days. Changing a password bumps `session_version`, which logs that user out everywhere.
- `proxy.ts`: Basic auth is replaced by a cheap cookie-format gate that redirects to the login page. The real check is `requireRole()` in the layout and in every action.
- Shell: bottom tab bar on mobile (Tableau de bord, Commandes, Produits, Stock), sidebar on desktop, logout.
- **Accept:** with no session, every `/admin` route **and** action refuses (tested by POSTing to the action endpoint directly); staff can't open products or users; 6 wrong passwords → 429; a tampered cookie is rejected; Lighthouse a11y ≥ 90 at 375 px.

### A3 — Orders · M
- List: status tabs with counts (new first), search by ref, phone or name, date range, 25 per page.
- Detail: items, totals and customer. One-tap Call and WhatsApp with a templated message per status (from the locale files: confirmation, ready for pickup, out for delivery). Only the valid next statuses show as buttons. Cancel asks for a reason. Internal note, and a timeline built from the audit rows.
- Print slip (print CSS) for the delivery company, and CSV export of the filtered list.
- Replaces today's read-only `/admin/orders`.
- **Accept:** an invalid transition is refused server-side; a cancel restores stock exactly once (a double-click is harmless); the list refreshes when the tab regains focus.

### A4 — Products + stock editing · L (owner; staff sees only stock fields)
- List: search, brand, new/used, archived and low-stock (≤ 3) filters. Each row expands to its variants with **inline price and stock inputs**, saved per row. This is the daily task, so it must be fastest.
- Editor (react-hook-form + product schema): identity, description, tagline, condition, specs, tags, featured.
- **Variant matrix:** define colors (name + hex) and storages, and a grid is generated. Each cell holds a SKU (auto-generated, editable until the first order), a price override, stock, and an on/off switch.
- Images per color: upload up to 5 MB, re-encoded by sharp to 1200 px webp. That strips EXIF and rejects anything that isn't an image, SVG and HTML included. Reorder and delete.
- The slug is generated from the name and **locked after first publish**, because links and search rankings depend on it.
- Duplicate product; archive and restore; no hard delete.
- Save runs in one transaction: stock differences become `edit` movements, an audit diff is written, and `revalidatePath` refreshes the product page, `/catalog`, `/` and `/sitemap.xml`.
- **Accept:** a new product is live on the storefront within 2 s of saving, with no rebuild; existing product pages are still prebuilt, and new ones render on first visit and are then cached; the edited product's JSON-LD is still valid; images go through `next/image`.

### A5 — Stock tools + dashboard · M
- Stock page: movement log (who, why, when), filterable by SKU and reason; manual adjustment with a required reason.
- CSV import `sku,price,stock`: a **dry-run diff** (changed / unknown SKU / invalid) → confirm → apply in one transaction. CSV export of all variants.
- Dashboard, to-do first: new orders to call, orders ready for pickup, low-stock variants; then orders and revenue over 7 and 30 days (confirmed + done) and the top 5 SKUs, all from SQL aggregates.
- **Accept:** importing 127 rows takes < 1 s; unknown SKUs are listed, not applied; dashboard numbers match a manual SQL spot-check.

### A6 — Runtime settings (optional) · M
- A `settings` table overrides part of `store.config.ts`: promo banner (text, link, on/off), delivery fee, stock-count display, and a holiday notice. Identity and contact stay in the config file, since they change rarely and affect SEO.
- Refactor: add a server-side `getSettings()`. Client components (`ProductBuy`, `CheckoutForm`) receive values as props instead of importing `storeConfig`, and the orders route reads the fee from settings.
- **Accept:** a fee change shows up immediately in checkout **and** in the API totals; config values act as defaults.

### A7 — Hardening + docs · S
- Tests (`node:test`): status machine, reservation race, CSV parser, session sign / verify / expiry, role matrix.
- Security pass: every `"use server"` file calls `requireRole()` (checked with grep in CI), uploads are validated, login is rate-limited, cookie flags are set, and `/admin` sends `X-Frame-Options: DENY` and `Cache-Control: no-store`.
- Backups: a nightly copy of `store.db` (Node host) or Turso point-in-time restore; the restore drill is documented.
- TEMPLATE_SETUP.md gets an admin section: env vars, first user, backups.
- **Accept:** A1–A6 criteria re-run green; storefront Lighthouse scores unchanged.

## 6. Out of scope (v3)
Multi-store, fine-grained permissions, customer accounts, editing markdown pages and locale files in the UI (edit the files), analytics beyond the dashboard, refunds accounting, delivery-company APIs (Yalidine, ZR Express…).

## 7. Operator notes
- Run the phases in order and paste Section 1 with each prompt.
- First live deploy: `db:migrate` → `db:seed` → `admin:user` → set `SESSION_SECRET` → build.
- Keep the `local` adapter for sales demos; use `db` for live clients.
- Rough effort (agent + review): S ≈ ½ day, M ≈ 1–1.5 days, L ≈ 2–3 days → **about 8–10 days** for A0–A7 (≈ 6–8 without A6).
