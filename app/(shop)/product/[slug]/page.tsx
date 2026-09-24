import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProductBuy } from "@/components/product/ProductBuy";
import { ProductCard } from "@/components/product/ProductCard";
import { SpecsTable } from "@/components/product/SpecsTable";
import { relatedProducts, variantPrice } from "@/lib/catalog";
import { categoryOf, multiCategory, storeConfig } from "@/lib/config/store.config";
import { repo } from "@/lib/data/repository";
import { t, variantLabel } from "@/lib/i18n";
import { absoluteUrl, cn } from "@/lib/utils";

export async function generateStaticParams() {
  return (await repo.getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const p = await repo.getProductBySlug((await params).slug);
  if (!p) return {};
  return {
    title: p.condition === "used" ? `${p.name} — ${t("product.used")}` : p.name,
    description: p.description.length > 160 ? `${p.description.slice(0, 157).replace(/\s+\S*$/, "")}…` : p.description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { images: [{ url: p.images[0], width: 800, height: 800 }] },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const product = await repo.getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = relatedProducts(await repo.getProducts(), product);
  const url = absoluteUrl(`/product/${product.slug}`);
  const category = multiCategory ? categoryOf(product.category) : undefined;
  const shelf = category ? `/catalog?category=${category.slug}` : "/catalog";

  return (
    <div className="mx-auto max-w-page px-4 py-5 md:px-5 md:py-7">
      <nav aria-label={t("product.breadcrumb")} className="mb-3 text-sm text-text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/catalog" className="inline-flex min-h-11 min-w-11 items-center justify-center text-primary">
              {t("nav.catalog")}
            </Link>
          </li>
          {category && (
            <>
              <li aria-hidden>›</li>
              <li>
                <Link href={shelf} className="inline-flex min-h-11 min-w-11 items-center justify-center text-primary">
                  {category.label}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>›</li>
          <li>
            <Link
              href={`${shelf}${category ? "&" : "?"}brand=${encodeURIComponent(product.brand)}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-primary"
            >
              {product.brand}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <ProductBuy product={product} />

      <div className={cn("mt-8 grid gap-7", product.specs && "md:grid-cols-2")}>
        <section>
          <h2 className="text-2xl font-semibold">{t("product.description")}</h2>
          <p className="mt-3 text-text-muted">{product.description}</p>
        </section>
        {product.specs && (
          <section>
            <h2 className="text-2xl font-semibold">{t("product.specs")}</h2>
            <div className="mt-2">
              <SpecsTable specs={product.specs} />
            </div>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">{t("product.related")}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          sku: product.variants[0].sku,
          brand: { "@type": "Brand", name: product.brand },
          image: product.images.map(absoluteUrl),
          url,
          offers: product.variants.map((v) => ({
            "@type": "Offer",
            sku: v.sku,
            name: `${product.name} ${variantLabel(v.color.name, v.storage)}`,
            price: variantPrice(product, v),
            priceCurrency: storeConfig.commerce.currency,
            availability: `https://schema.org/${v.stockQty > 0 ? "InStock" : "OutOfStock"}`,
            itemCondition: `https://schema.org/${product.condition === "used" ? "UsedCondition" : "NewCondition"}`,
            url,
            seller: { "@type": "Organization", name: storeConfig.identity.name },
          })),
        }}
      />
    </div>
  );
}
