# Product Categories — Implementation Plan

> **Status (September 2026):** C1–C4 built (see CHANGELOG.md). Decided with the user: demo ships phones + accessories; accessory details
> live in the description (no spec table); the home page stays on phones; cross-sell is later.

Lets a store sell more than phones (cases, chargers, earbuds, memory cards…) without splitting the template.
A phone-only client configures a single category and sees no change.

## 0. Feasibility

Cart, checkout, orders, stock movements, CSV and search work by **SKU**, so they need no change.
Three phone-only assumptions block other products:

| Assumption | Where |
| --- | --- |
| Every product has the 9-field phone spec sheet | `specsSchema` required (`lib/data/schemas.ts`), `SpecsTable`, `specLine`, editor, `gen-placeholder-images.mjs` |
| Every variant has a storage size | `variant.storage` required, `storage INTEGER NOT NULL` (`001_init.sql`), `color · storage` labels built inline in 8 places |
| There is one kind of product | no category field: catalog, nav, home hero and related products mix everything |

## 1. Design rules

- **Category = navigation.** `category` is a slug on the product and only decides where the product is listed (menu, catalog, home).
- **What a product page shows follows the data.** Specs table only if `product.specs` exists. Storage picker only if any variant has
  `storage`. A tablet then works like a phone and a memory card gets a storage picker, with no "kind" logic in the storefront.
- **The config flag is only an editor default.** `categories[].specs` tells the admin editor to show the phone spec sheet and to start
  new products with a storage row. The storefront never reads it.
- **Primary category = first in the config.** It drives the home hero, new arrivals and the brand strip.
- **Slugs are data keys.** Rename a category's label freely; never change its slug once products use it.
- Other variant options (wattage, cable length) are **out of scope**: list each one as a separate product.

## 2. Contracts

```ts
// lib/config/schema.ts (store.config.ts gets the values)
categories: z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),      // "Smartphones", "Accessoires"
  specs: z.boolean(),            // editor: phone spec sheet + default storage row
})).min(1)                       // + refine: unique slugs

// lib/data/schemas.ts
productSchema: + category: z.string().regex(/^[a-z0-9-]+$/)
               specs: specsSchema.optional()
variantSchema: storage: z.number().int().positive().optional()
productInputSchema duplicate key: `${color}|${storage ?? ""}`

// lib/i18n.ts, next to formatStorage (the only place that builds a variant label)
variantLabel(color: string, storage?: number | null): string   // "Noir · 256 Go" | "Noir"

// lib/catalog.ts
ProductFilters: + category?: string    // single value, URL `?category=accessories`
```

```sql
-- lib/db/migrations/002_categories.sql
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'phones';
-- specs stays NOT NULL: a product without a spec sheet stores the JSON text 'null'.
-- SQLite can't drop NOT NULL in place, so variants is rebuilt (no table references it by FK).
CREATE TABLE variants_new (… same columns …, storage INTEGER CHECK (storage > 0), …);
INSERT INTO variants_new SELECT … FROM variants;
DROP TABLE variants;
ALTER TABLE variants_new RENAME TO variants;
CREATE INDEX variants_product ON variants(product_id, position);
```

The migration runner already wraps each file in one transaction.

## 3. Phases

Each phase ends with `npm run typecheck`, `npm run lint`, `npm test`, a self-check of its acceptance criteria and a CHANGELOG entry.

### C1 — Model, database, logic

- Config: `categories` in the schema and in `store.config.ts` (demo: `phones` with `specs: true`, `accessories` with `specs: false`).
- `schemas.ts`: the contract changes above.
- `002_categories.sql`.
- `adapters/db.ts`: map `category`; `specs` `'null'` → `undefined`; `storage` `NULL` ↔ `undefined`; write `category` in
  `saveProduct`; `listProducts` gets `category`. `repository.ts`: `VariantRow.storage: number | null`, `listProducts` query `category`.
- `adapters/local.ts`: throw at load if a product's category isn't in the config (a bad `products.json` fails the build, not a customer).
- `scripts/db.ts` seed: `category` column, `JSON.stringify(p.specs ?? null)`, nullable storage.
- `lib/catalog.ts`: `category` filter and URL param; `ram` filter / facet skip products without specs; storage facet skips
  variants without storage; `searchText` skips missing storage; `relatedProducts` ranks same category first, then brand, then price.
- `variantLabel` replaces the inline labels in `ProductBuy` (cart label, WhatsApp text, sticky bar), `api/orders/route.ts`,
  product JSON-LD, admin dashboard, admin products list, `stock/actions.ts`.
- Just enough type fixes for the storefront and editor to compile (optional chaining); behavior changes come in C2 and C3.

**Tests:**
- `logic.test.ts`: category filter; RAM filter excludes accessories; facets ignore missing specs and storage; related prefers same category.
- `admin.test.ts`: an accessory (no specs, no storage, 2 colors) round-trips through `saveProduct` / `getProduct`; an order on a
  storage-less SKU reserves stock.
- Migration test: apply 001 only (temp dir holding just that file), insert a phone, apply 002 → rows intact,
  `category = 'phones'`, `NULL` storage accepted, `0` rejected.

**Acceptance:** existing DB migrates with no data change; all current tests pass; demo storefront looks identical.

### C2 — Storefront

- `components/layout/links.ts`: with several categories, one link per category (`/catalog?category=slug`) replaces "Boutique";
  with one, "Boutique" stays. "Occasion" is unchanged. Desktop header goes from 5 to 6 links.
  `ponytail:` 5+ categories won't fit the md header; move info links to the footer only if a client needs that.
- `catalog/page.tsx`: ignore a category slug that isn't in the config; facets come from that category's products, not all;
  h1 and `generateMetadata` use the category label; canonical keeps `?category=` (category pages are worth indexing).
- `CatalogView`: category chips ("Tout" + categories) above the grid, only when there are several categories. Switching category
  clears brand / storage / RAM / condition filters, keeps `q`, sort and price. Storage and RAM groups are hidden when their facet is
  empty. "Reset" never clears the category.
- `ProductCard`: phone spec line if `specs`, otherwise the tagline (one line, truncated).
- `VariantPicker`: storage fieldset only if a variant has storage. `find()` already works with `undefined === undefined`.
- Product page: specs section only if `specs` (description takes the full width otherwise); breadcrumb
  Catalog › Category › Brand, brand link scoped to the category.
- Home: hero, tiles, new arrivals and brand strip use the primary category.
- `sitemap.ts`: one URL per category.
- Locales: `catalog.all`.

**Acceptance:** at 375 px and 1280 px, an accessory page has no specs table, no storage picker and no "0 Go" anywhere (card,
cart, checkout, confirmation, WhatsApp message, order). `/catalog?category=accessories` shows no storage or RAM filters.
A phone-only config (one category) renders exactly as before.

### C3 — Admin

- `ProductEditor`:
  - Category select as the first field.
  - Spec sheet section shown when the category has `specs: true`. On submit `specs` is `undefined` otherwise.
  - The storage axis can be emptied, leaving one row per color. Adding the first storage moves each color's row onto it
    (same SKU and stock); removing the last one moves it back, so no stock is thrown away.
  - On a *new* product, changing category resets the storage axis to that category's default (`[128]` or none).
  - Matrix title reads "Couleurs" when there's no storage axis.
- `products/actions.ts` `saveProduct`: server-side checks that the category exists in the config and that `specs` is present when the
  category requires it (issues on `category` / `specs.*`). No new action, so `security.test.ts` is unchanged.
- Products list: category filter (`productQuerySchema.category`).
- Stock export: empty cell for a missing storage.
- Locales: `admin.products.editor.category`, `admin.products.allCategories`, colors-only matrix title and hint.

**Acceptance:** from a phone, the owner creates an accessory with 2 colors in under a minute, with no spec fields to fill;
turns an existing phone's storage axis off and on without losing stock; staff still can't edit products.

### C4 — Demo content and docs

- `products.json`: `"category": "phones"` on the 20 phones, plus about 6 accessories covering every case:
  - a case with 3 colors, tagged with the phone models it fits (search finds it through its tags);
  - a 20 W charger (1 color);
  - earbuds (2 colors, one out of stock);
  - a USB-C cable;
  - a screen protector;
  - a microSD card with 64 / 128 / 256 Go (a storage picker on an accessory).
- `gen-placeholder-images.mjs`: a product without specs gets a simple colored accessory render instead of a phone.
- `CLAUDE.md` (features, "slugs are data keys", `'null'` specs), `TEMPLATE_SETUP.md` (categories step), `CHANGELOG.md`.

## 4. Out of scope

- Variant options other than color and storage (wattage, length): separate products.
- "Accessoires compatibles" on the phone page (cross-sell by tag match).
- Free key/value specs for accessories: the description carries the details.
- A separate `/accessoires` route: `?category=` on `/catalog` covers it.
- Per-category filter definitions or icons.

## 5. Files

About 25: 1 migration, 4 in `lib/`, 1 script, 8 storefront, 5 admin, 3 locales, `products.json`, docs.
