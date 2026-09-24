# Template setup — new store in 7 steps

A new client touches **only** these places. Any edit you need in `app/` or `components/`
is a template bug: fix it in the template, not in the client copy.

| What | Where |
| --- | --- |
| Store data (name, contact, toggles…) | `lib/config/store.config.ts` |
| Visual design | `styles/tokens.css` (+ `public/fonts/`) |
| Logo, OG image, product photos | `public/` |
| Catalog, copy, legal pages | `content/` |
| Secrets, data source | `.env.local` / host env vars (see `.env.example`) |

Requires Node ≥ 22.18.

## 1. Clone

```bash
git clone <template-repo> my-store && cd my-store
npm install
cp .env.example .env.local
```

## 2. Config — `lib/config/store.config.ts`

Validated by Zod at build time: a typo fails `npm run build` with the exact field.

- `locale`: `fr` (default), `en`, or `ar`. `ar` is a stub that switches the page to RTL; finish `content/locales/ar.json` first.
- `identity`: `name`, `logo` (path under `/public`), `tagline`.
- `contact`: display `phone`, `whatsapp` (international digits only, e.g. `213555123456`), `email`, `address`, optional `geo`, `mapEmbedUrl` (`https://www.google.com/maps?q=LAT,LNG&z=16&output=embed`), `mapUrl`, `hours` (days `Mo`…`Su`, listed in consecutive order).
- `commerce`: `currency`, `orderPrefix` (for refs like `MS-1042`), `deliveryEnabled` / `pickupEnabled` (at least one), `codEnabled` (required when delivery is on), `deliveryFeeFlat`.
- `features`: `showUsedPhones` (off = used phones disappear everywhere, including the API), `showPromoBanner`, `showStockCount` (exact "3 left" or just "Low stock").
- `categories`: what the store sells, e.g. `phones` + `accessories`. Each has a `slug`, a menu `label` and
  `specs` (the admin editor shows the phone spec sheet and starts new products with a storage row). The first one is
  the home page's category. With a single category the menu shows one "Boutique" link and no category chips.
  The slug is stored on every product: rename the label freely, never the slug.
- `promo`: banner text and link.
- `seo`: `siteUrl` (production origin, used for canonical URLs, sitemap and JSON-LD), `title`, `description`, `ogImage`.

## 3. Design — `styles/tokens.css`

Replace the file. Components only use token utilities, and Tailwind's default palette is
disabled, so nothing else carries colour.

**Required:** `--color-primary`, `-primary-fg`, `-surface`, `-surface-alt`, `-text`, `-text-muted`,
`-accent`, `-success`, `-warning`, `-danger` · `--font-heading`, `--font-body` · `--radius-sm/md/lg` ·
`--shadow-card` · `--space-1` … `--space-8`.

**Optional** (derived fallbacks otherwise): `--color-border`, `--color-inverse` (header + dark hero),
`--color-inverse-fg`, `--color-focus`, `--shadow-product` (drop-shadow syntax, no spread),
`--radius-pill`, `--tracking-heading`, `--font-size-body`, `--container-max`.

Notes:
- `--space-1..8` also drive Tailwind's `p-1`…`p-8`, `gap-*`, `size-*` and so on. Keep them roughly increasing.
- Keep `--color-accent` readable on `--color-inverse`: it colours secondary buttons on the dark hero.
- Custom fonts: put `.woff2` files in `public/fonts/` and declare `@font-face` at the top of `tokens.css`.
- From a `DESIGN.md`: map brand/CTA colour → primary, page canvas → surface, alternate band → surface-alt, body ink → text, secondary ink → text-muted, link-on-dark → accent. Check text-muted on surface-alt reaches 4.5:1.

Tested: a required-tokens-only file (Starbucks palette, serif headings) built and rendered correctly with no code changes.

## 4. Assets — `public/`

- `logo.svg`: a square mark that stays readable on the dark header and as a favicon.
- `og.png`: 1200×630 social preview (path set in `seo.ogImage`).
- Product photos: any path you reference in `products.json`. The convention is
  `products/<slug>/<color>-front.webp` and `-back.webp`, square, on a transparent or light background.
  `npm run seed:images` only generates placeholders for referenced files that don't exist yet.

## 5. Content — `content/`

- `products.json`: array of products, each with a `category` (a config slug) and nested `variants`
  (one per color × storage, or one per color when there's no storage). Price and stock live on the variant
  (`priceOverride` falls back to `basePrice`). `storage` and `specs.ram` are in GB (1024 = 1 TB).
  `specs` (the phone spec sheet) and `storage` are optional: an accessory without them gets no specs table and
  no storage picker; put its details in `description` and compatible models in `tags` (search reads them).
  An optional `tagline` (≤ 90 chars) shows in the home hero and on cards of products without specs.
  `featured: true` puts a product of the first category on the home page; the most expensive one becomes the hero.
  The file is Zod-validated at build. A missing or unknown `category` reads as the first configured one, and
  variants must all have a `storage` or none.
- `locales/*.json`: every UI string. The store-specific marketing copy is `home.trust.*` and `product.deliveryInfo`.
- `pages/about.<locale>.md`, `pages/warranty.<locale>.md`: the first `# ` line is the page title.
  `{{store}}`, `{{phone}}`, `{{email}}`, `{{address}}` and `{{orderPrefix}}` are filled in from the config.
- `wilayas.json`: delivery regions (the 58 Algerian wilayas).

## 6. Verify and deploy

```bash
npm test && npm run lint && npm run build && npm start
```

Checklist: home, catalog filters, one product page, add to cart, a checkout in each enabled mode,
then the admin (section 7): log in, move that order through its statuses, edit a price.

**Hosting (default: a local Algerian VPS).** One Node server (`npm run build && npm start`, Node ≥ 22.18)
behind an HTTPS reverse proxy (Caddy: `store.example.dz { reverse_proxy localhost:3000 }`), or Coolify for
git-push deploys. The database file and the uploaded photos live in `.data/`: keep it on persistent disk.
Several small stores fit on one 1 vCPU / 4 GB VPS, one directory and one port each.
Vercel is not the default: the free plan forbids commercial sites and its filesystem is ephemeral
(it would need Turso for the database and an object store for photos; photo storage is local-only today).

Keep the `local` adapter (no database, no admin) for sales demos.

## 7. Admin panel (`/admin`)

**Decisions for this client** (write them down here when you set a store up):
- Hosting: Node host (VPS) with `DATABASE_URL=file:.data/store.db` and local photos. *(default)*
- Stock: reserved when the order is placed, given back when it's cancelled. *(default, implemented)*
  Fake cash-on-delivery orders hold stock until someone cancels them, so staff should call every new order.

**First deploy**

```bash
cp .env.example .env.local        # then set:
#   DATA_ADAPTER=db
#   SESSION_SECRET=$(openssl rand -base64 32)
#   TZ=Africa/Algiers
npm run db:migrate                # creates .data/store.db (also run after every template update)
npm run db:seed                   # imports content/products.json (+ legacy .data/orders.json); safe to re-run
npm run admin:user -- --username owner --role owner --name "Owner name"   # prompts for the password
npm run build && npm start
```

After the seed, the database is the catalog: edit products in `/admin/products`, not in `products.json`
(re-seeding never overwrites existing rows; it only adds missing ones).

**Users and roles.** `owner` does everything. `staff` handles orders and adjusts stock but can't change prices,
products or users. Add staff in `/admin/users`. Forgotten owner password: run `npm run admin:user` again
with the same username; it resets the password and logs that user out everywhere.

**Daily use.** Orders: call every *Nouvelle* order (one-tap call and WhatsApp with a message per status),
then Confirmée → Prête → Terminée, or cancel with a reason (stock comes back). Products: inline price and
stock per variant; the editor for everything else (color × storage matrix, photos per color). Stock:
manual adjustments with a reason, CSV export, and CSV import with a preview before anything is applied.

**Backups (do this on day one).** `npm run db:backup` writes a consistent copy of the database to
`.data/backups/` (keeps the last 14). Schedule it nightly and copy it off the server together with the photos:

```cron
0 3 * * * cd /srv/mystore && npm run db:backup && rsync -a .data/backups .data/uploads backup@other-host:mystore/
```

**Restore drill** (try it once before going live): stop the server, copy a backup over `.data/store.db`
(delete `store.db-wal` and `store.db-shm` if present), put the photos back in `.data/uploads/`, start the
server, log in and open an order.

**Security notes.** Serve `/admin` over HTTPS only (the session cookie is `Secure` in production).
Behind a proxy, make it set `X-Forwarded-For`, which the login throttle reads (5 failures per 15 min per IP
and per username). Every Server Action and admin route checks the role itself; `npm test` fails if one doesn't.

## Swapping the data source (Odoo…)

Implement the `Repository` interface (`lib/data/repository.ts`) in `lib/data/adapters/<name>.ts`
and select it in that file. Pages and components never import an adapter.
For Odoo: `product.template` → Product, `product.product` → Variant (keyed by `default_code` = SKU),
stock from `qty_available` per variant, and `createOrder` → `sale.order` whose `name` becomes the ref.
Feature toggles (used phones) are applied in the repository wrapper, so they carry over to any adapter.
The admin panel needs the `db` adapter (`AdminRepository`).
