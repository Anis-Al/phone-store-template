import { multiCategory, storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";

export type NavLink = { href: string; label: string };

// ponytail: one link per category; past ~4 categories the md header overflows, move info links to the footer then.
export const shopLinks = (): NavLink[] => [
  ...(multiCategory
    ? storeConfig.categories.map((c) => ({ href: `/catalog?category=${c.slug}`, label: c.label }))
    : [{ href: "/catalog", label: t("nav.catalog") }]),
  ...(storeConfig.features.showUsedPhones ? [{ href: "/catalog?condition=used", label: t("nav.used") }] : []),
];

export const infoLinks = (): NavLink[] => [
  { href: "/contact", label: t("nav.contact") },
  { href: "/about", label: t("nav.about") },
  { href: "/warranty", label: t("nav.warranty") },
];
