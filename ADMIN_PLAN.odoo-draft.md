# DRAFT — Odoo addendum to ADMIN_PLAN.md

Parked "just in case". Only relevant if a client already runs its stock and orders in Odoo.
It comes from the original template plan: "data layer must allow a future Odoo JSON-RPC adapter"
and "Odoo live stock/order sync" (v2).

## What changes if a client uses Odoo

- **Odoo is already their back office**, so our admin must not become a second one. Skip the
  product and stock editing (A4–A5); keep only the orders view (A2 auth + A3).
- **A0:** add the decision "Does the client run Odoo? Yes → do A2 + A3 (orders only), then stop."
- **Contract:** add `canWrite: boolean` to `AdminRepository`. The Odoo adapter returns `false`, which
  hides the product and stock editing UI.
- **Adapter mapping** (implements the existing `Repository`):
  `product.template` → Product, `product.product` → Variant (keyed by `default_code` = SKU),
  stock from `qty_available` per variant, `createOrder` → `sale.order` (its `name` becomes the order ref).
- **Out of scope:** Odoo write-sync (editing Odoo data from our admin).
