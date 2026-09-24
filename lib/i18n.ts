import ar from "@/content/locales/ar.json";
import en from "@/content/locales/en.json";
import fr from "@/content/locales/fr.json";
import { DAYS } from "@/lib/config/schema";
import { storeConfig } from "@/lib/config/store.config";

// Locale is chosen per deployment in store.config.ts. fr is the reference dictionary:
// en/ar may be partial — missing keys fall back to fr.
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<typeof fr>;

const dicts: Record<string, unknown> = { fr, en, ar };
export const locale = storeConfig.locale;
export const dir = locale === "ar" ? "rtl" : "ltr";
const intlLocale = `${locale}-${storeConfig.contact.address.country}`;

const lookup = (dict: unknown, key: string) => {
  const v = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
  return typeof v === "string" ? v : undefined;
};

export function t(key: TKey, vars?: Record<string, string | number>): string {
  const s = lookup(dicts[locale], key) ?? lookup(fr, key) ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")) : s;
}

const money = new Intl.NumberFormat(intlLocale, {
  style: "currency",
  currency: storeConfig.commerce.currency,
  maximumFractionDigits: 0,
});
export const formatPrice = (n: number) => money.format(n);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
/** "Mo" → localized short day (2024-01-01 was a Monday). */
export const dayName = (d: (typeof DAYS)[number]) =>
  weekday.format(new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(d))));

/** ["Sa","Su",…,"Th"] → "sam. – jeu." (days are authored in consecutive order). */
export const dayRange = (days: readonly (typeof DAYS)[number][]) =>
  days.length > 2 ? `${dayName(days[0])} – ${dayName(days[days.length - 1])}` : days.map(dayName).join(", ");

/** Machine-readable form for schema.org / <time>. */
export const SCHEMA_DAYS: Record<(typeof DAYS)[number], string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

export const formatStorage = (gb: number) =>
  gb >= 1024 ? t("units.tb", { n: gb / 1024 }) : t("units.gb", { n: gb });

export const variantLabel = (color: string, storage?: number | null) =>
  storage ? `${color} · ${formatStorage(storage)}` : color;

/** "Livraison à domicile" / "Livraison au bureau (stop-desk)" / "Retrait en boutique" (admin list, order page, slip). */
export const fulfillmentLabel = (o: { fulfillment: string; customer: { desk?: boolean } }) =>
  t(o.fulfillment === "pickup" ? "admin.orders.pickup" : o.customer.desk ? "admin.orders.desk" : "admin.orders.delivery");
