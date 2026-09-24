import { BadgeCheck, ShieldCheck, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { StoreLocator } from "@/components/layout/StoreLocator";
import { ProductCard } from "@/components/product/ProductCard";
import { StoreJsonLd } from "@/components/StoreJsonLd";
import { buttonClass } from "@/components/ui/button";
import { facets, filterProducts, fromPrice } from "@/lib/catalog";
import { categorySlugs } from "@/lib/config/store.config";
import type { Product } from "@/lib/data/schemas";
import { repo } from "@/lib/data/repository";
import { formatPrice, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0];

function Tile({ product, dark, hero }: { product: Product; dark?: boolean; hero?: boolean }) {
  const href = `/product/${product.slug}`;
  return (
    <section
      className={cn(
        "flex flex-col items-center overflow-hidden px-5 pt-8 text-center",
        dark ? "bg-inverse text-inverse-fg" : "bg-surface-alt text-text",
      )}
    >
      <p className={cn("text-sm", dark ? "opacity-70" : "text-text-muted")}>{product.brand}</p>
      {hero ? (
        <h1 className="mt-1 text-4xl font-semibold md:text-6xl">{product.name}</h1>
      ) : (
        <h2 className="mt-1 text-3xl font-semibold md:text-4xl">{product.name}</h2>
      )}
      <p className={cn("mt-3 max-w-xl text-lg md:text-2xl", dark ? "opacity-80" : "text-text-muted")}>
        {product.tagline ?? firstSentence(product.description)}
      </p>
      <p className="mt-2 text-sm tabular-nums">
        {t("product.from")} {formatPrice(fromPrice(product))}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href={href} className={buttonClass()}>
          {t("home.shopNow")}
          <span className="sr-only"> {product.name}</span>
        </Link>
        <Link
          href={href}
          className={buttonClass({ variant: dark ? "secondary-on-dark" : "secondary" })}
        >
          {t("home.learnMore")}
          <span className="sr-only"> {product.name}</span>
        </Link>
      </div>
      <div className={cn("relative mt-6 w-full", hero ? "aspect-[4/3] max-w-3xl" : "aspect-square max-w-md")}>
        <Image
          src={product.images[1] ?? product.images[0]}
          alt=""
          fill
          priority={hero}
          sizes={hero ? "(min-width: 768px) 768px, 100vw" : "(min-width: 768px) 448px, 100vw"}
          className="object-contain object-bottom drop-shadow-product"
        />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const category = categorySlugs[0];
  const shelf = await repo.getProducts({ category });
  const featured = filterProducts(shelf, { featured: true, sort: "price-desc" }); // flagship leads
  const newest = filterProducts(shelf, { sort: "newest", condition: ["new"], limit: 4 });
  const { brands } = facets(shelf);
  const [hero, ...tiles] = featured;
  const trust = [
    { icon: ShieldCheck, title: t("home.trust.authenticTitle"), text: t("home.trust.authenticText") },
    { icon: BadgeCheck, title: t("home.trust.warrantyTitle"), text: t("home.trust.warrantyText") },
    { icon: Wrench, title: t("home.trust.serviceTitle"), text: t("home.trust.serviceText") },
  ];

  return (
    <>
      <PromoBanner />
      {hero && <Tile product={hero} dark hero />}
      {tiles.length > 0 && (
        <div className="grid gap-3 p-3 md:grid-cols-2">
          {tiles.slice(0, 2).map((p) => (
            <Tile key={p.id} product={p} />
          ))}
        </div>
      )}

      <section className="mx-auto max-w-page px-5 py-8">
        <h2 className="text-2xl font-semibold md:text-3xl">{t("home.brands")}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {brands.map((b) => (
            <li key={b}>
              <Link
                href={`/catalog?category=${category}&brand=${encodeURIComponent(b)}`}
                className="inline-flex min-h-11 items-center rounded-pill border border-border px-5 font-semibold hover:border-primary hover:text-primary"
              >
                {b}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-page px-5 pb-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold md:text-3xl">{t("home.newArrivals")}</h2>
          <Link href={`/catalog?category=${category}&sort=newest`} className="inline-flex min-h-11 items-center text-primary">
            {t("home.seeAll")} ›
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {newest.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-page px-5 py-8">
          <h2 className="sr-only">{t("home.trustTitle")}</h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {trust.map((x) => (
              <li key={x.title} className="flex gap-4">
                <x.icon aria-hidden size={32} className="shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{x.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{x.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <StoreLocator />
      <StoreJsonLd />
    </>
  );
}
