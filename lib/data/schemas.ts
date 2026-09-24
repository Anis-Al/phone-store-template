import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const money = z.number().int().nonnegative(); // whole currency units (DZD has no cents in practice)

export const variantSchema = z.object({
  sku: z.string().min(1),
  productId: z.string(),
  color: z.object({ name: z.string(), hex }),
  storage: z.number().int().positive().optional(), // GB
  priceOverride: money.optional(),
  stockQty: z.number().int().nonnegative(),
  images: z.array(z.string()).min(1).optional(),
});

export const specsSchema = z.object({
  screen: z.string(),
  chipset: z.string(),
  ram: z.number().int().positive(), // GB
  storage: z.string(),
  battery: z.string(),
  mainCamera: z.string(),
  frontCamera: z.string(),
  os: z.string(),
  network: z.string(),
});

export const productSchema = z.object({
  id: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  category: z.string().default(""),
  brand: z.string(),
  model: z.string(),
  name: z.string(),
  description: z.string(),
  tagline: z.string().max(90).optional(), // short hero line on the home page
  images: z.array(z.string()).min(1),
  basePrice: money,
  condition: z.enum(["new", "used"]),
  specs: specsSchema.optional(),
  tags: z.array(z.string()),
  featured: z.boolean(),
  createdAt: z.iso.date(),
  variants: z.array(variantSchema).min(1),
});

const oneAxis = (vs: { storage?: number }[]) => vs.every((v) => v.storage) || vs.every((v) => !v.storage);

/** products.json shape: variants nested, productId filled in by the adapter. */
export const productsFileSchema = z.array(
  productSchema
    .extend({ variants: z.array(variantSchema.omit({ productId: true })).min(1) })
    .refine((p) => oneAxis(p.variants), { path: ["variants"], message: "all variants have a storage, or none" })
    .transform((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, productId: p.id })) })),
);

export const ORDER_STATUSES = ["new", "confirmed", "ready", "done", "cancelled"] as const;
export const CALL_OUTCOMES = ["no_answer", "callback"] as const;

export const orderSchema = z.object({
  id: z.string(), // human ref, e.g. MS-1042
  items: z.array(
    z.object({ sku: z.string(), qty: z.number().int().positive(), unitPrice: money, label: z.string() }),
  ),
  fulfillment: z.enum(["delivery", "pickup"]),
  customer: z.object({
    name: z.string(),
    phone: z.string(),
    wilaya: z.string().optional(),
    address: z.string().optional(), // the commune for stop-desk
    desk: z.boolean().optional(), // delivery to the carrier's office (stop-desk) instead of the door
  }),
  paymentMethod: z.enum(["cod", "instore"]),
  status: z.enum(ORDER_STATUSES),
  totals: z.object({ subtotal: money, deliveryFee: money, total: money }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().optional(),
  note: z.string().optional(), // internal, admin only
});

/** Admin product editor payload. SKUs stay CSV-safe; `prevSku`/`stockWas` identify an existing variant. */
export const skuSchema = z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, "admin.errors.sku");
export const productInputSchema = productSchema
  .omit({ id: true, createdAt: true, variants: true })
  .extend({
    id: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "admin.errors.slug"),
    brand: z.string().trim().min(1, "admin.errors.required"),
    model: z.string().trim().min(1, "admin.errors.required"),
    name: z.string().trim().min(2, "admin.errors.required"),
    description: z.string().trim().min(1, "admin.errors.required"),
    tagline: z.string().trim().max(90).optional(),
    images: z.array(z.string()).min(1, "admin.errors.images"),
    variants: z
      .array(
        variantSchema.omit({ productId: true, sku: true }).extend({
          sku: skuSchema,
          color: z.object({ name: z.string().trim().min(1, "admin.errors.required").max(40), hex }),
          prevSku: z.string().optional(),
          stockWas: z.number().int().nonnegative().optional(),
        }),
      )
      .min(1, "admin.errors.variants"),
  })
  .superRefine((p, ctx) => {
    if (!oneAxis(p.variants)) ctx.addIssue({ code: "custom", path: ["variants"], message: "admin.errors.storageMix" });
    const seen = new Set<string>();
    p.variants.forEach((v, i) => {
      const combo = `${v.color.name.toLowerCase()}|${v.storage ?? ""}`;
      if (seen.has(v.sku) || seen.has(combo))
        ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "admin.errors.duplicate" });
      seen.add(v.sku).add(combo);
    });
  });

export type Variant = z.infer<typeof variantSchema>;
export type Product = z.infer<typeof productSchema>;
export type Condition = Product["condition"];
export type Order = z.infer<typeof orderSchema>;
export type OrderStatus = Order["status"];
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export type OrderDraft = Omit<Order, "id" | "status" | "createdAt" | "updatedAt" | "note">;
export type ProductInput = z.infer<typeof productInputSchema>;
