# Phone store template

A reusable storefront for phone shops: catalog, product pages, cart, a one-page checkout
(cash on delivery or in-store pickup), WhatsApp handoff, and an admin panel (orders, products,
stock, users) on a SQLite/libSQL database.
Built with Next.js 16, TypeScript (strict), Tailwind v4 driven by design tokens, Zustand and Zod.

- **Test, deploy, run several stores (short guide):** see [GUIDE.md](GUIDE.md).
- **New store, in detail:** see [TEMPLATE_SETUP.md](TEMPLATE_SETUP.md).
- **History and verification notes per phase:** see [CHANGELOG.md](CHANGELOG.md).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # storefront logic + admin (stock race, status machine, sessions, CSV, uploads, roles)
npm run lint && npm run build

# admin panel (DATA_ADAPTER=db and SESSION_SECRET in .env.local)
npm run db:seed    # creates .data/store.db from content/products.json
npm run admin:user -- --username you --role owner   # then open /admin
```

Layout: `app/` (routes) · `components/` · `lib/config` (store config + schema) ·
`lib/data` (repository + adapters) · `lib/db` (client + SQL migrations) · `app/admin` (admin panel) ·
`content/` (products, locales, pages) · `styles/tokens.css`.
