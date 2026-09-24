import { storeConfig } from "@/lib/config/store.config";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const whatsappLink = (text?: string) =>
  `https://wa.me/${storeConfig.contact.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const telLink = () => `tel:${storeConfig.contact.phone.replace(/[^\d+]/g, "")}`;

export const absoluteUrl = (p: string) => new URL(p, storeConfig.seo.siteUrl).toString();

/** "iPhone 17 Pro (copie)" → "iphone-17-pro-copie" */
export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 80);
