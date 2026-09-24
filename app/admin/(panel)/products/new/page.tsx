import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("admin.products.new") };

/** New product, or a copy of ?from=<id> (nothing is saved until "Enregistrer"). */
export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  const { admin } = await requireRole("owner");
  const from = (await searchParams).from;
  const source = typeof from === "string" ? await admin.getProduct(from) : null;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center self-start text-primary">
        ← {t("admin.products.editor.back")}
      </Link>
      <PageHeader title={t("admin.products.new")} />
      <ProductEditor product={source} copy={Boolean(source)} brands={await admin.getBrands()} />
    </div>
  );
}
