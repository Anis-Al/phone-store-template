import type { Metadata } from "next";
import Link from "next/link";
import { CatalogView } from "@/components/catalog/CatalogView";
import { ProductCard } from "@/components/product/ProductCard";
import { buttonClass } from "@/components/ui/button";
import { facets, parseFilters, type SearchParamsLike } from "@/lib/catalog";
import { categoryOf } from "@/lib/config/store.config";
import { repo } from "@/lib/data/repository";
import { t } from "@/lib/i18n";

function readFilters(sp: SearchParamsLike) {
  const filters = parseFilters(sp);
  const category = categoryOf(filters.category);
  return { filters: { ...filters, category: category?.slug }, category };
}

export async function generateMetadata({ searchParams }: PageProps<"/catalog">): Promise<Metadata> {
  const { category } = readFilters(await searchParams);
  return {
    title: category?.label ?? t("catalog.title"),
    description: t("catalog.description"),
    // Filtered URLs consolidate onto the catalog, or onto their category page.
    alternates: { canonical: category ? `/catalog?category=${category.slug}` : "/catalog" },
  };
}

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const { filters, category } = readFilters(await searchParams);
  const [products, inCategory] = await Promise.all([
    repo.getProducts(filters),
    repo.getProducts({ category: filters.category }),
  ]);

  return (
    <div className="mx-auto max-w-page px-4 py-5 md:px-5 md:py-7">
      <h1 className="mb-5 text-3xl font-semibold md:text-5xl">
        {filters.q ? t("catalog.searchFor", { q: filters.q }) : (category?.label ?? t("catalog.title"))}
      </h1>
      <CatalogView facets={facets(inCategory)} filters={filters} count={products.length}>
        {products.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg bg-surface-alt px-5 py-8 text-center">
            <p className="text-xl font-semibold">{t("catalog.empty")}</p>
            <p className="mt-2 text-text-muted">{t("catalog.emptyHint")}</p>
            <Link href={category ? `/catalog?category=${category.slug}` : "/catalog"} className={buttonClass({ variant: "secondary", className: "mt-5" })}>
              {t("catalog.reset")}
            </Link>
          </div>
        )}
      </CatalogView>
    </div>
  );
}
