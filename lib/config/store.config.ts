import { storeConfigSchema } from "./schema";

/**
 * Every store-specific value lives here. New client = edit this file (+ tokens, content, assets).
 * DEMO VALUES — replace phone/WhatsApp/email/address before going live.
 */
export const storeConfig = storeConfigSchema.parse({
  locale: "fr",
  identity: {
    name: "MobiStore",
    logo: "/logo.svg",
    tagline: "Smartphones neufs et reconditionnés, garantis.",
  },
  contact: {
    phone: "0555 00 00 00",
    whatsapp: "213555000000",
    email: "contact@mobistore.example",
    address: {
      street: "12 rue Didouche Mourad",
      city: "Alger Centre",
      region: "Alger",
      postalCode: "16000",
      country: "DZ",
    },
    geo: { lat: 36.7661, lng: 3.0506 },
    mapEmbedUrl: "https://www.google.com/maps?q=36.7661,3.0506&z=16&output=embed",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=36.7661,3.0506",
    hours: [
      { days: ["Sa", "Su", "Mo", "Tu", "We", "Th"], opens: "09:30", closes: "20:00" },
      { days: ["Fr"], opens: "14:00", closes: "20:00" },
    ],
  },
  commerce: {
    currency: "DZD",
    orderPrefix: "MS",
    deliveryEnabled: true,
    pickupEnabled: true,
    codEnabled: true,
    deliveryFees: { home: 800, desk: 500 }, // home = at the door, desk = carrier's office (stop-desk)
  },
  features: {
    showUsedPhones: true,
    showPromoBanner: true,
    showStockCount: true,
  },
  categories: [
    { slug: "phones", label: "Smartphones", specs: true },
    { slug: "accessories", label: "Accessoires", specs: false },
  ],
  promo: {
    text: "Livraison 58 wilayas · Paiement à la livraison",
    href: "/catalog",
  },
  home: {
    // Unset: the most expensive featured product. A product slug ("samsung-galaxy-s25-ultra"), or a custom banner:
    // { title: "Soldes Ramadan", text: "Jusqu'à −20 %", image: "/hero.jpg", cta: { label: "J'en profite", href: "/catalog" } }
    hero: undefined,
  },
  seo: {
    siteUrl: "https://mobistore.example",
    title: "MobiStore — Smartphones à Alger",
    description:
      "iPhone, Samsung, Xiaomi, Oppo, Realme… neufs et d'occasion garantis. Livraison partout en Algérie, paiement à la livraison ou retrait en boutique.",
    ogImage: "/og.png",
  },
});

export const categorySlugs = storeConfig.categories.map((c) => c.slug);
export const categoryOf = (slug?: string) => storeConfig.categories.find((c) => c.slug === slug);
export const multiCategory = storeConfig.categories.length > 1;
