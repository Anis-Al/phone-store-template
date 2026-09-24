@AGENTS.md

# Phone store template

A reusable storefront for phone shops in Algeria: Next.js 16 (App Router, Turbopack), TypeScript
strict, Tailwind v4 driven by `styles/tokens.css`, Zustand (cart), Zod, react-hook-form.
Phases 1–5 of the original plan, admin phases A0–A5 + A7 (`ADMIN_PLAN.md`) and categories C1–C4
(`CATEGORIES_PLAN.md`) are done; see `CHANGELOG.md`.
New-client steps: `TEMPLATE_SETUP.md`.

## Features

**Built (storefront, Phases 1–5):**
- Layout: sticky dark header (desktop nav, mobile drawer, search, cart badge), footer, WhatsApp
  button (hidden over forms, lifted above the sticky buy bar), promo banner (config toggle).
- Home: dark hero (most expensive featured phone), two feature tiles, brand strip, new arrivals,
  trust row, store locator (map, hours, call / WhatsApp / directions).
- Catalog `/catalog`: filters (brand, price, storage, RAM, condition) and sort, all kept in the URL;
  sold-out products last; empty state; loading skeleton.
- Search: debounced typeahead (`/api/search`) with subsequence-fuzzy matching; Enter → `/catalog?q=`.
- Product `/product/[slug]` (prebuilt): gallery, color × storage picker (out-of-stock combos disabled),
  specs table, sticky mobile buy bar, related products, WhatsApp question link, Product JSON-LD.
- Cart: Zustand + localStorage, quantity capped by stock; drawer on desktop, `/cart` page on mobile.
- Checkout `/checkout`: delivery (wilaya + address + flat fee, cash on delivery) or pickup (pay in
  store), both from config; DZ mobile validation; French error messages.
- Orders `POST /api/orders`: Zod validation, server-side re-pricing, stock check, refs like `MS-1001`,
  per-IP rate limit; stored by the local adapter in `.data/orders.json`.
- `/confirmation`: order summary + WhatsApp deep link with the full order.
- Info pages: `/contact` (form opens a pre-filled WhatsApp message), `/about` and `/warranty` from markdown.
- SEO: per-page metadata, Open Graph, `sitemap.xml`, `robots.txt`, LocalBusiness JSON-LD; 404 page, error boundary.
- Categories (config `categories`): menu link per category, `/catalog?category=` chips; specs table and storage
  picker follow the product's data (accessories have neither). Home: featured from any category, the rest from the first.
- Demo seed: 20 phones, 6 brands, 127 SKUs, 2 used phones, low / out-of-stock cases; 6 accessories.

**Built (admin panel, `ADMIN_PLAN.md` A0–A5, A7; needs `DATA_ADAPTER=db`):**
- A1 libSQL adapter (`lib/data/adapters/db.ts`): SQL migrations, idempotent seed from JSON, stock reserved
  at order time (CHECK constraint → 409 on a lost race), restored once on cancel.
- A2 `/admin/login` (scrypt, HMAC cookie, throttle), owner / staff roles, mobile tab bar / desktop sidebar, `/admin/users`.
- A3 orders: status tabs, search, dates, detail with call / WhatsApp templates, status machine, cancel reason,
  note, timeline, print slip, CSV export.
- A4 products: inline price / stock rows, editor with color × storage matrix, photos (sharp → WebP, `/media`),
  duplicate, archive; storefront revalidated on save. Category filter; products, orders and stock lists paged.
- A5 `/admin/stock` (movement log, manual adjustment, CSV import with dry run, export) and dashboard.
- A7 role-matrix test, backups (`db:backup`), docs.

**Not built:** A6 runtime settings (fee / promo still in `store.config.ts`); S3 photo driver; a deployment
phase (VPS setup script, HTTPS, scheduled backups) is documented in TEMPLATE_SETUP.md §7 but not automated.

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (node:test on
`lib/**/*.test.ts`) · `npm run seed:images` (placeholder phone / accessory renders for missing image paths) ·
`npm run db:migrate` · `npm run db:seed` · `npm run db:backup` · `npm run admin:user -- --username x --role owner`.

## Hard rules

- **Store-specific values** live only in `lib/config/store.config.ts` (Zod-validated), `content/`
  or `public/`. Never in components.
- **Visual values** live only in `styles/tokens.css`. `app/globals.css` wipes Tailwind's default
  palette, shadows, radii and fonts, so only token utilities exist (`bg-primary`, `text-text-muted`…).
- **Data** goes only through `repo` from `lib/data/repository.ts`. Pages and components never import
  an adapter or `content/products.json`. Admin code gets `admin` (the `AdminRepository`) from `requireRole()`.
- **Admin authorization:** every admin page, route handler and Server Action calls `requireRole()` itself
  (`"owner"` for prices, products, users, CSV import). `lib/security.test.ts` holds the role matrix: a new
  `"use server"` file or action must be added there, or `npm test` fails.
- **UI strings** live in `content/locales/{fr,en,ar}.json`. `fr` is the reference: typed keys, fallback to fr.
- Mobile-first (375 px), touch targets ≥ 44 px, logical CSS properties (`ms-`, `pe-`, `start-`).
- **Zod on all external input** (URL params, request bodies, storage). The server re-prices every order.
- Deliberate shortcuts carry a `ponytail:` comment naming the ceiling and the upgrade path.

## Gotchas

- `--space-1..8` override Tailwind's `p-1…8`, `gap-*`, `size-*` (e.g. `size-5` = 24 px, `size-7` = 48 px).
  Steps 9+ use the default 0.25rem multiplier (`h-11` = 44 px).
- There is no tailwind-merge. Don't override a conflicting utility through `className`; add a variant
  instead (e.g. the button variant `secondary-on-dark`).
- UI backed by localStorage (cart) must be gated with `useHydrated()` from `lib/cart.ts`, or hydration
  mismatches. Keep that hook out of server-imported modules.
- Next 16: `proxy.ts` (not middleware), async `params`/`searchParams`, `PageProps<"/route">` helpers.
  Read `node_modules/next/dist/docs/` before using an API you're unsure of.
- Files added to `public/` after the build are **not** served by `next start`.
- `lib/catalog.ts`, `lib/order.ts`, `lib/csv.ts`, `lib/session.ts`, `lib/db/client.ts` and
  `lib/data/adapters/db.ts` must stay importable by plain Node (tests, `scripts/db.ts`): relative imports
  with a `.ts` extension, runtime deps limited to node builtins, `zod`, `@libsql/client`; the rest `import type`.
- Database writes are one `db.batch()` each; never hold an interactive transaction across `await`s (the
  file binding is synchronous). Conditions go in the SQL (`WHERE status = :from`, the stock CHECK).
- Stock edits from the admin are deltas from the value the screen showed (`stockWas`), not absolute sets,
  so orders placed meanwhile aren't overwritten. Only the CSV import sets absolute values.
- `npm run db:seed` inserts every products.json row missing from the database (`INSERT OR IGNORE`). On a live
  store run only `db:backup` + `db:migrate`; seeding would add the demo products (phones and accessories).
- `/admin` is a 404 unless `DATA_ADAPTER=db`; it needs `SESSION_SECRET` (≥ 32 chars). Uploaded photos live
  in `UPLOAD_DIR` (default `.data/uploads`) and are served by `app/media/[...path]`, not `public/`.

## Code notes

Kept here instead of as code comments, one subsection per feature. `ponytail:` markers stay in the code.

### Layout

- Admin pages share the dashboard's width: `mx-auto max-w-5xl px-4 md:px-6`. Use it for new admin pages.
- Header links (`components/layout/Header.tsx`) are `whitespace-nowrap` with `px-2` below `lg`, so the 6 links of a
  two-category store fit on one row at 768 px.

### Admin lists

- `Pager` (`components/admin/Pager.tsx`): prev / next links for orders, stock and products; the current filters stay
  in the URL (`withQuery`). Tabs and the filter form drop `page`, so a new filter starts on page 1.
- Page sizes live only in `PAGE_SIZE` (`lib/admin.ts`): products 5, orders 5, stock movements 20. Orders and
  stock pass theirs to the adapter (`pageSize`, required); products are sliced in the page after `listProducts`
  loads and filters them all. An out-of-range products `?page=` shows the last page.

### Categories (`CATEGORIES_PLAN.md`, C1–C4)

- **Config** (`lib/config/schema.ts`, `store.config.ts`): `categories` drive the menu, catalog chips and home page;
  the first one is the primary category. `slug` is a data key stored on products: rename `label`, never the slug.
  `categories[].specs` only sets admin editor defaults (spec sheet shown, new products start with a 128 GB row);
  the storefront reads `product.specs` / `variant.storage`. Helpers: `categorySlugs` (primary first),
  `categoryOf(slug)`, `multiCategory` (several → a menu link and chip per category; one → one "Boutique" link).
- **Category fallback** (`withCategory`, `lib/catalog.ts`): a missing or unknown category (older products.json,
  renamed slug, the migration's `'phones'` default) reads as the primary one, applied where adapters load products
  (local: on first use; db: `loadProducts`, slugs passed to `createDbAdapter`). So admin `listProducts` filters
  category in JS, not SQL, and `productSchema.category` defaults to `""`.
- **Schema** (`lib/data/schemas.ts`): no `specs` = no spec sheet (accessories: details in `description`, compatible
  models in `tags`, which search reads). `variant.storage` is absent for most accessories. `oneAxis`: variants all
  have a storage or none (products.json and editor input), because the editor matrix and the picker have one axis.
- **Migration 002**: `products.category` (existing rows → `'phones'`); `variants` rebuilt so `storage` can be NULL
  (SQLite can't drop NOT NULL in place; nothing references variants by FK). No spec sheet = JSON text `'null'`
  in `specs`, mapped to `undefined` by `toProduct`.
- **Local adapter**: products.json is parsed on first use, not at import, because `repository.ts` imports the
  module in db mode too. A malformed file still fails the local build (`generateStaticParams` reads it).
- **Labels:** `variantLabel(color, storage?)` (`lib/i18n.ts`) is the only place "Noir · 256 Go" is built (cart,
  orders, WhatsApp, JSON-LD, admin); without storage it's just the color. Never build one inline.
- **Storefront:**
  - Catalog page: an unknown `?category=` is dropped like any junk param; facets come from the category's
    products; the canonical keeps `?category=`.
  - `CatalogView`: switching category clears brand / storage / RAM / condition (a different shelf), keeps
    search, sort and price; Reset never clears the category; storage and RAM groups hide when empty.
  - `specLine`: phone line, or the tagline for products without a spec sheet (2-line clamp).
  - `VariantPicker`: storage choice only if the product has storage.
  - Product page: specs section only with a spec sheet (description then spans the width); breadcrumb
    Catalog › Category › Brand when there are several categories.
  - Home: products loaded once; featured (hero + tiles) from every category, newest and brands from the primary one.
- **Admin:**
  - `saveProduct` action re-checks the category against the config and requires a spec sheet for `specs`
    categories (the shared schema is plain-Node and can't read the config).
  - `autoSku`: 2 letters per model word (4 if it has digits), so products sharing a prefix don't collide
    ("Coque silicone iPhone 16" → `COSIIP16-NO`).
  - Matrix: one row per color × storage, or per color with no storage (`rows`, `cellKey`). A new product starts
    with its category's storage default, and changing category resets it. `moveAxis` (`lib/catalog.ts`) keeps a
    color's SKU and stock when the axis goes to or from no storage; storages new to the axis start on.
- **Placeholders** (`gen-placeholder-images.mjs`): products without specs get a shape picked from the slug
  (case, charger, earbuds, cable, glass, microSD; a box otherwise).

## Decisions (September 2026)

- **Admin panel:** implemented per `ADMIN_PLAN.md` (A0–A5, A7). A6 (runtime settings) needs the user's go-ahead.
- **Database:** SQLite through libSQL (`@libsql/client`) in file mode (`.data/store.db`). Postgres only
  if several stores ever share one database.
- **Hosting (default):** a local Algerian VPS, running one Node server with the database file and uploaded
  photos on local disk. Algérie Télécom VPS Pack 1 (1 vCPU / 4 GB / 50 GB SSD, 2,500 DA/month)
  holds several client stores. Alternatives: ICOSNET (Algiers + Oran data centers), CIRTASOFT
  (confirm the physical location). Many "VPS Algeria" sites are foreign resellers, so always check.
  Setup: HTTPS reverse proxy (Caddy) or Coolify for git-push deploys, plus a daily off-server copy of the database.
  Vercel is **not** the default: the free plan doesn't allow commercial sites and the filesystem is ephemeral.
- **Odoo:** out of scope. Parked in `ADMIN_PLAN.odoo-draft.md`; don't bring it up unless the user does.
- **Stock timing (implemented default):** reserve stock when the order is created, restore it on cancel.
- The demo store "MobiStore" uses fake contact values; replace them per client.
- **Repository:** https://github.com/Anis-Al/phone-store-template, branch `main`.
