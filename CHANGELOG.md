# Changelog

## Phase 1 — Foundation
- Next.js 16 (App Router, Turbopack) + TypeScript strict + Tailwind v4, wired to `styles/tokens.css`.
  Tailwind's default palette/shadows/radii/fonts are wiped (`app/globals.css`), so only token utilities compile.
- Tokens: Apple design system (from `DESIGN.md`) mapped onto the template contract, plus optional
  extras (`--color-border`, `--color-inverse`, …) that fall back to values derived from the required set.
- `lib/config/store.config.ts` + Zod schema (`lib/config/schema.ts`): identity, contact, commerce,
  features, promo, SEO. Invalid config fails at build.
- Data layer: `Repository` interface (`lib/data/repository.ts`) + local JSON adapter; feature toggles
  (used phones) applied once in the repo wrapper, for every adapter.
- Layout shell: Header (cart badge, search, desktop nav), MobileNav (drawer), Footer, WhatsAppFab,
  PromoBanner. Primitives in `components/ui` (hand-rolled, shadcn-style; native `<dialog>` sheet).
- i18n: `content/locales/{fr,en,ar}.json`, typed keys, fr fallback, `dir="rtl"` for ar, logical CSS props.
- Self-hosted Inter (`public/fonts`), SF Pro first on Apple devices.
- `npm test`: node built-in runner covering pricing, filters, fuzzy search, phone validation, order pricing.
- Verified: token change (`--color-primary`) and config change (store name) propagate with no component
  edit; no component imports data files; Lighthouse a11y 100 (home, mobile).

## Phase 2 — Catalog & Product
- Seed: 20 phones / 6 brands (Apple, Samsung, Xiaomi, Oppo, Realme, Honor), 127 color×storage SKUs,
  full specs, 2 used phones, low-stock/out-of-stock combos and one fully sold-out model (demo states).
- `npm run seed:images` renders brand-free placeholder phone images (front/back per color) for any
  image path in `products.json` that doesn't exist yet — real stores just drop in photos.
- Catalog `/catalog`: brand / price / storage / RAM / condition filters + sort, all in the URL
  (shareable, survive reload), bad params dropped by Zod; empty state; sold-out always last.
  Filter changes run in a transition so the old grid stays visible (no skeleton flash).
- Header search: debounced (200 ms) typeahead on `/api/search`, subsequence-fuzzy ("iphne", "galxy").
- ProductCard: image, spec line, "from" price = cheapest in-stock variant, condition + stock badges.
- Product page (SSG via `generateStaticParams`): Gallery, VariantPicker (OOS combos disabled; price,
  stock and images follow the variant), SpecsTable, sticky mobile buy bar, related products,
  Product JSON-LD with one Offer per SKU.
- Verified: filters combine + survive reload; variant switch keeps every box in place (measured);
  sold-out variant cannot be added; product pages prerendered (●); JSON-LD parses with required fields.

## Phase 3 — Cart, Checkout, Orders
- Cart: Zustand + localStorage (`lib/cart.ts`), qty stepper capped by variant stock, totals.
  Desktop opens a sheet, mobile goes to `/cart`. Hydration-safe (localStorage UI renders after mount).
- One-page checkout (`/checkout`, react-hook-form + shared Zod schema): Delivery / Pickup from config.
  Delivery = wilaya (58, `content/wilayas.json`) + address + flat fee + COD; pickup = store address,
  hours, pay in store. DZ mobile validation (05/06/07, +213 accepted, normalised). Messages from locale.
- `POST /api/orders`: Zod-validated (unknown keys stripped), re-priced server-side from catalog,
  stock checked, persisted by the repository (local adapter: `.data/orders.json`, atomic writes,
  serialised refs `MS-1001`…), naive per-IP rate limit (10 / 10 min).
- `/confirmation`: ref + summary from sessionStorage (orders are never readable by ref from the server)
  + WhatsApp deep link with the full order summary.
- `/admin/orders`: read-only table behind HTTP Basic auth (`proxy.ts`, `ADMIN_USER`/`ADMIN_PASSWORD`);
  404 when no password is set.
- Verified (375 px, headless Chrome): full happy path in both modes; empty/invalid submits blocked with
  French messages; cart survives reload and clears after order; API ignores a tampered `unitPrice`,
  refuses OOS / over-stock / unknown SKU / bad wilaya / bad phone; rate limit returns 429; admin 401/200.

## Phase 4 — Home, Info & Trust
- Home in Apple tile rhythm: dark hero (the most expensive featured phone), two light feature tiles,
  brand strip, promo banner (toggle), new arrivals, trust row, store locator (map, hours, call /
  WhatsApp / directions). Optional product `tagline` for hero copy.
- `/contact` (channels, WhatsApp-prefilled contact form, map, hours). `/about` and `/warranty` render
  from `content/pages/*.md` with `{{store}}`-style placeholders filled from config.
- SEO: per-page title, description and canonical; Open Graph + `public/og.png`; `sitemap.xml`
  (pages + products + images); `robots.txt` (admin/api/cart/checkout/confirmation excluded, and those
  pages are `noindex`); LocalBusiness (`MobilePhoneStore`) JSON-LD built from config on home + contact.
- Verified: hardcoded-copy scan of `app/` and `components/` clean (every store string comes from config
  or content); JSON-LD blocks parse with Google-required fields; home CLS 0.024 (Lighthouse mobile).

## Phase 5 — Hardening & Packaging
- 404 page, error boundary with retry + WhatsApp fallback, catalog loading skeleton; empty states
  for catalog, search, cart, checkout and admin.
- Tap targets ≥ 44 px (breadcrumbs, cart line links fixed); WhatsApp FAB hides over forms and lifts
  above the sticky buy bar; no horizontal overflow at 375 / 768 / 1280 on the 6 core pages.
- Secondary button on dark surfaces uses the accent token (contrast fix: 3.8:1 → AA).
- `TEMPLATE_SETUP.md` (clone → config → tokens → assets → content → deploy, plus Odoo adapter notes),
  `.env.example`, README.
- Spin-up verified once: required-only Starbucks tokens + new config (English, pickup off, used phones
  off, no promo) + 7-product catalog → clean build and a working store, while the SHA-1 of all 75 code
  files stayed identical. Restored afterwards.
- Final run (production build, Lighthouse mobile): performance 92–98, accessibility 100,
  best practices 100 and SEO 100 on every indexable page (cart/checkout 66 because they are `noindex`
  on purpose). `npm test` 8/8, lint clean, build clean.

## Admin A0 — Decisions
- Hosting: Node host (local VPS), `file:.data/store.db`, photos on local disk. Stock: reserved when the order
  is placed, given back on cancel. Recorded in TEMPLATE_SETUP.md §7.

## Admin A1 — Database adapter
- `@libsql/client` (only new dependency). Plain `.sql` migrations (`lib/db/migrations/`) + runner recording
  `_migrations`; WAL mode; 5 s busy timeout. `scripts/db.ts` (run by Node type stripping): `db:migrate`,
  `db:seed` (products.json + legacy orders.json, `INSERT OR IGNORE`), `admin:user`, `db:backup`.
- `lib/data/adapters/db.ts` implements `Repository` + `AdminRepository`. Rows go through `productSchema` /
  `orderSchema`, so bad rows fail loudly. `DATA_ADAPTER=local|db` in `repository.ts`; local stays the default.
- Every write is one `batch()` (synchronous in the libsql binding → no interleaving in-process; SQLite's lock
  across processes). Reservation guard is the `CHECK (stock_qty >= 0)` constraint: a line going negative rolls
  the whole order back and `/api/orders` answers 409. Refs come from `seq` inside the same transaction.
- `/api/orders` revalidates the ordered products' pages and `/` (stock moved).
- Storefront chrome moved from the root layout to `(shop)`/`(info)` group layouts (`StoreShell`), so the
  admin has its own shell.
- Verified: `DATA_ADAPTER=db` build keeps product pages prebuilt (●); seed twice → 147 then 0 rows;
  20 parallel HTTP orders on a stock-3 SKU → exactly 3 × 201 and 17 × 409 (and the same in `npm test`).

## Admin A2 — Auth + admin shell
- scrypt password hashes (`lib/session.ts`), cookie `adm` = `userId.expires.sessionVersion.hmac`
  (HttpOnly, Secure in production, SameSite=Lax, Path=/admin, 7 days). A new password or disabling a user
  bumps `session_version`. HTTP Basic auth and `ADMIN_USER`/`ADMIN_PASSWORD` are gone.
- `proxy.ts`: cookie-shape gate → `/admin/login`, plus `X-Frame-Options: DENY`, `Cache-Control: no-store`,
  `X-Robots-Tag: noindex`. The real check is `requireRole()` in every page, action and admin route.
- Login is a Server Action throttled to 5 failures / 15 min per IP and per username; unknown users still pay
  for a hash (no username probing by timing).
- Shell: bottom tabs on mobile, sidebar on desktop; `/admin/users` (owner): add, reset password, disable.
- Verified over HTTP: no cookie / forged cookie / staff cookie POSTed straight to an owner action → 303 / 303 /
  404 and nothing written; 6th attempt after 5 failures refused; tampered cookie → login.

## Admin A3 — Orders
- List: status tabs with counts, search by ref / phone / name, date range, 25 per page, CSV export of the
  filtered list, refresh when the tab regains focus. Detail: items, totals, customer, one-tap call and a
  WhatsApp message per status (locale templates), next-status buttons only, cancel with a required reason,
  internal note, timeline from the audit rows, print slip (print CSS).
- Status machine in `lib/order.ts`; the adapter's update is guarded by `WHERE status = :from`, and cancel
  gives back exactly the order's `order` movements, so a double click restores stock once (verified in the
  browser and in `npm test`).

## Admin A4 — Products + stock editing
- List: search, brand, new/used, archived and low-stock filters; each product expands to its variants with
  inline price (owner) and stock inputs saved per row. Stock is sent as a delta from what the row showed, so
  orders placed meanwhile are kept.
- Editor (owner, react-hook-form + `productInputSchema` on both sides): identity, specs, tags, featured,
  color × storage matrix (SKU auto-suggested, editable until first ordered), photos per color with reorder
  and delete, duplicate (`/admin/products/new?from=id`, nothing saved until "Enregistrer"), archive/restore.
  Slug generated from the name and locked after the first save.
- Uploads: Server Action (body limit 6 MB), `sharp` → ≤1200 px WebP, EXIF dropped, SVG/HTML/non-images
  refused; content-hashed files in `UPLOAD_DIR`, served by `app/media/[...path]` with immutable caching.
- Save = one transaction: product, variants, `edit` movements, audit diff; then the storefront is revalidated.
- Verified (production build): a new product answered 200 right after saving (MISS, then HIT), appeared in
  the sitemap, JSON-LD parsed with one Offer per SKU; existing product pages still prebuilt; price edit
  visible on the product page.

## Admin A5 — Stock tools + dashboard
- Stock page: movement log (who / why / when, linked orders), filter by SKU and reason; manual adjustment
  with a required reason (staff); CSV import `sku,price,stock` with a dry-run diff (changed / identical /
  unknown / invalid) → confirm → one transaction (owner); CSV export of all variants, re-importable as is
  (columns found by header name; `;` separator and quotes handled).
- Dashboard: new orders to call, ready orders, low-stock variants, orders and revenue over 7 / 30 days
  (confirmed + ready + done), top 5 SKUs over 30 days, all SQL aggregates.
- Verified: 136-row import applied in 343 ms (HTTP round trip); dashboard figures equal a manual SQL query.

## Admin A6 — Runtime settings
- Not built (optional in the plan). Delivery fee, promo banner and stock-count display still come from
  `store.config.ts`.

## Categories C1–C4 (`CATEGORIES_PLAN.md`)
- `categories` in the config (demo: Smartphones, Accessoires). Products get a `category`; `specs` and variant
  `storage` are optional. Migration `002_categories.sql` adds the column (existing rows → `phones`) and rebuilds
  `variants` so `storage` can be `NULL` (`CHECK storage > 0`). Specs-less products store the JSON text `'null'`.
- `variantLabel()` (lib/i18n.ts) builds every "color · storage" label: cart, orders, WhatsApp, JSON-LD, admin.
- Storefront: one menu link per category, category chips on `/catalog` (switching clears facet filters, keeps
  search / sort / price), storage and RAM filters hidden when empty, category title + canonical, category URLs in
  the sitemap. Product page: specs table and storage picker only when the product has them; breadcrumb
  Catalog › Category › Brand; related products stay in the category. Home stays on the first category.
- Admin: category select (first field); spec sheet only for `specs` categories; the storage axis can be emptied
  (one row per color) and going to or from no storage keeps each color's SKU and stock; server checks the category
  and the required spec sheet; category filter on the product list.
- Demo: 6 accessories (case, charger, earbuds with one color sold out, cable, screen protector, microSD with
  storage sizes); `seed:images` draws simple accessory shapes for products without specs.
- Review fixes: products.json is parsed on first use (db-mode stores no longer depend on it); a missing or
  unknown category reads as the primary one (older products.json, renamed slugs, migrated rows); variants all
  have a storage or none; SKU suggestions use every word of the model; home loads its category once; category
  helpers `categorySlugs` / `categoryOf` / `multiCategory` in store.config.ts.
- Header: links no longer wrap at 768 px (6 links with two categories): `whitespace-nowrap`, `px-2` below `lg`.
- Admin: products list paged; orders, stock and products share `components/admin/Pager.tsx`. Page sizes set once
  in `PAGE_SIZE` (lib/admin.ts): products 5, orders 5 (was 25), stock movements 20 (was 50).
  Admin pages use the dashboard's width (`max-w-5xl`).
- `npm test` (24): category filter / facets / related / fallback, one-axis rule, editor axis move, accessory
  round-trip + reservation, migration on existing rows.

## Admin A7 — Hardening + docs
- `npm test` (19): stock race, rollback, status machine + single restore, delta edits, SKU lock, archive,
  sessions (tamper / other secret / expiry), uploads, CSV parser, and a static role matrix: every
  `"use server"` export and admin route must call `requireRole()` with the expected role.
- Backups: `npm run db:backup` (`VACUUM INTO`, keeps 14) + cron / off-server copy + restore drill in
  TEMPLATE_SETUP.md §7.
- Final run (production build, Lighthouse mobile): admin pages accessibility 100 at 375 px (login, dashboard,
  orders, order, products, editor, stock, users); storefront unchanged: performance 91–95, accessibility,
  best practices and SEO 100 (checkout SEO 66, `noindex` on purpose). Lint and typecheck clean.
