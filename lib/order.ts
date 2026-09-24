import { z } from "zod";
import type { Order, OrderStatus, Product, Variant } from "./data/schemas";

// Error messages are i18n keys (see content/locales/*.json → "errors").

/** DZ mobile: 05/06/07 + 8 digits, optional +213/00213 prefix. Normalised to 0XXXXXXXXX. */
export const dzPhone = z
  .string()
  .transform((s) => s.replace(/[\s.()-]/g, ""))
  .pipe(z.string().regex(/^(?:\+213|00213|0)[567]\d{8}$/, "errors.phone"))
  .transform((s) => `0${s.slice(-9)}`);

/** 0555123456 → 213555123456 (wa.me format). */
export const dzPhoneIntl = (phone: string) => `213${phone.replace(/\D/g, "").slice(-9)}`;

const fee = z.number().int().nonnegative();
/** content/wilayas.json row: optional fees (DA) override the config defaults for that wilaya. */
export const wilayaSchema = z.object({ code: z.string().regex(/^\d{2}$/), name: z.string().min(1), home: fee.optional(), desk: fee.optional() });
export type Wilaya = z.infer<typeof wilayaSchema>;

/** The wilaya's own fee, else the config default. null = stop-desk is off (no `deliveryFees.desk`). */
export function deliveryFee(defaults: { home: number; desk?: number }, wilaya: Pick<Wilaya, "home" | "desk">, desk: boolean) {
  if (!desk) return wilaya.home ?? defaults.home;
  return defaults.desk === undefined ? null : (wilaya.desk ?? defaults.desk);
}

const base = z.object({
  fulfillment: z.enum(["delivery", "desk", "pickup"]), // desk = delivered to the carrier's office (stop-desk), still COD
  name: z.string().trim().min(2, "errors.name").max(80, "errors.name"),
  phone: dzPhone,
  wilaya: z.string().optional(),
  address: z.string().trim().max(200, "errors.address").optional(),
});

type Base = z.infer<typeof base>;
const requireAddress = (v: Base, ctx: z.RefinementCtx) => {
  if (v.fulfillment === "pickup") return;
  if (!v.wilaya) ctx.addIssue({ code: "custom", path: ["wilaya"], message: "errors.wilaya" });
  // Stop-desk only needs the commune (the office is picked with the customer on the phone).
  const desk = v.fulfillment === "desk";
  if ((v.address?.length ?? 0) < (desk ? 2 : 5))
    ctx.addIssue({ code: "custom", path: ["address"], message: desk ? "errors.commune" : "errors.address" });
};

export const checkoutFormSchema = base.superRefine(requireAddress);

/** POST /api/orders body. Unknown keys (e.g. a tampered unitPrice) are stripped by Zod. */
export const orderInputSchema = base
  .extend({
    items: z
      .array(z.object({ sku: z.string().min(1).max(64), qty: z.number().int().min(1).max(10) }))
      .min(1)
      .max(20),
  })
  .superRefine(requireAddress);

export type OrderInput = z.infer<typeof orderInputSchema>;

type Priced =
  | { ok: true; items: Order["items"]; totals: Order["totals"] }
  | { ok: false; error: "unknown_sku" | "out_of_stock"; sku: string };

/** Server-side pricing from catalog data only — client prices are never trusted. */
export function priceOrder(
  items: { sku: string; qty: number }[],
  catalog: { product: Product; variant: Variant }[],
  deliveryFee: number,
  label: (p: Product, v: Variant) => string,
): Priced {
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.sku, (qty.get(i.sku) ?? 0) + i.qty);

  const lines: Order["items"] = [];
  for (const [sku, n] of qty) {
    const hit = catalog.find((c) => c.variant.sku === sku);
    if (!hit) return { ok: false, error: "unknown_sku", sku };
    if (hit.variant.stockQty < n) return { ok: false, error: "out_of_stock", sku };
    const unitPrice = hit.variant.priceOverride ?? hit.product.basePrice;
    lines.push({ sku, qty: n, unitPrice, label: label(hit.product, hit.variant) });
  }
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return { ok: true, items: lines, totals: { subtotal, deliveryFee, total: subtotal + deliveryFee } };
}

/**
 * Order edit (admin): kept SKUs keep the price and label they were ordered at, added SKUs take the catalog's.
 * `wanted` has one entry per SKU; qty 0 drops the line. Stock is checked by the database, not here.
 */
export function repriceEdit(
  current: Order["items"],
  wanted: { sku: string; qty: number }[],
  catalog: { product: Product; variant: Variant }[],
  label: (p: Product, v: Variant) => string,
): { ok: true; items: Order["items"] } | { ok: false; error: "unknown_sku" | "empty_order" } {
  const items: Order["items"] = [];
  for (const { sku, qty } of wanted) {
    if (!qty) continue;
    const kept = current.find((i) => i.sku === sku);
    if (kept) {
      items.push({ ...kept, qty });
      continue;
    }
    const hit = catalog.find((c) => c.variant.sku === sku);
    if (!hit) return { ok: false, error: "unknown_sku" };
    items.push({ sku, qty, unitPrice: hit.variant.priceOverride ?? hit.product.basePrice, label: label(hit.product, hit.variant) });
  }
  return items.length ? { ok: true, items } : { ok: false, error: "empty_order" };
}

/** Items, customer and delivery can still change (nothing packed yet). */
export const canEdit = (s: OrderStatus) => s === "new" || s === "confirmed";

/** Order status machine. `done` and `cancelled` are final; cancelling restores reserved stock once. */
export const NEXT_STATUS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["done", "cancelled"],
  done: [],
  cancelled: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => NEXT_STATUS[from].includes(to);

/** Thrown by an adapter that reserves stock when a line can't be covered any more (lost race). */
export class OutOfStockError extends Error {
  sku: string;
  constructor(sku: string) {
    super(`out_of_stock: ${sku}`);
    this.sku = sku;
  }
}
