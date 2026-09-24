import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM");
export const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const heroBanner = z.object({
  title: z.string().min(1),
  text: z.string().optional(),
  image: z.string().startsWith("/"), // path in /public
  cta: z.object({ label: z.string().min(1), href: z.string().min(1) }),
});
export type HeroBanner = z.infer<typeof heroBanner>;

export const storeConfigSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  identity: z.object({
    name: z.string().min(1),
    logo: z.string().startsWith("/"), // path in /public
    tagline: z.string(),
  }),
  contact: z.object({
    phone: z.string().min(6), // display + tel: link
    whatsapp: z.string().regex(/^\d{8,15}$/, "international digits only, e.g. 213555123456"),
    email: z.email(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      region: z.string(), // wilaya
      postalCode: z.string(),
      country: z.string().length(2),
    }),
    geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
    mapEmbedUrl: z.url(),
    mapUrl: z.url(), // "open in maps" link
    hours: z.array(z.object({ days: z.array(z.enum(DAYS)).min(1), opens: time, closes: time })),
  }),
  commerce: z
    .object({
      currency: z.string().length(3),
      orderPrefix: z.string().regex(/^[A-Z]{1,4}$/),
      deliveryEnabled: z.boolean(),
      pickupEnabled: z.boolean(),
      codEnabled: z.boolean(),
      // Defaults for wilayas without their own fee in content/wilayas.json. No `desk` = no stop-desk option.
      deliveryFees: z.object({ home: z.number().int().nonnegative(), desk: z.number().int().nonnegative().optional() }),
    })
    .refine((c) => c.deliveryEnabled || c.pickupEnabled, "enable delivery or pickup")
    .refine((c) => !c.deliveryEnabled || c.codEnabled, "delivery needs COD (card payments are v2)"),
  features: z.object({
    showUsedPhones: z.boolean(),
    showPromoBanner: z.boolean(),
    showStockCount: z.boolean(),
  }),
  categories: z
    .array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1), specs: z.boolean() }))
    .min(1)
    .refine((cs) => new Set(cs.map((c) => c.slug)).size === cs.length, "duplicate category slug"),
  promo: z.object({ text: z.string(), href: z.string() }),
  home: z
    .object({
      hero: z
        .union([z.string().regex(/^[a-z0-9-]+$/, "product slug"), heroBanner])
        .optional(),
    })
    .optional(),
  seo: z.object({
    siteUrl: z.url(),
    title: z.string(),
    description: z.string(),
    ogImage: z.string().startsWith("/"),
  }),
});

export type StoreConfig = z.infer<typeof storeConfigSchema>;
