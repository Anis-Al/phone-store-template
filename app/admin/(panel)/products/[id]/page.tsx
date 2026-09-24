import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("admin.products.edit") };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { admin } = await requireRole("owner");
  const product = await admin.getProduct((await params).id);
  if (!product) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <Link href="/admin/products" className="inline-flex min-h-11 items-center self-start text-primary">
        ← {t("admin.products.editor.back")}
      </Link>
      <PageHeader title={product.name}>
        {product.archivedAt ? (
          <Badge tone="danger">{t("admin.products.archived")}</Badge>
        ) : (
          <Link href={`/product/${product.slug}`} target="_blank" className="inline-flex min-h-11 items-center text-primary">
            {t("admin.products.view")} ↗
          </Link>
        )}
      </PageHeader>
      <ProductEditor product={product} brands={await admin.getBrands()} saved={(await searchParams).saved === "1"} />
    </div>
  );
}
