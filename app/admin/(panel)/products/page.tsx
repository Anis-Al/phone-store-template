import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pager } from "@/components/admin/Pager";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { PAGE_SIZE, productQuerySchema, withQuery } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { multiCategory, storeConfig } from "@/lib/config/store.config";
import { totalStock, variantPrice } from "@/lib/catalog";
import { t, variantLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { saveVariant, setArchived } from "./actions";

export const metadata: Metadata = { title: t("admin.products.title") };

const LOW = 3;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { user, admin } = await requireRole();
  const q = productQuerySchema.parse(await searchParams);
  const [products, brands] = await Promise.all([
    admin.listProducts({ ...q, archived: q.archived === "1", lowStock: q.lowStock === "1" }),
    admin.getBrands(),
  ]);
  const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE.products));
  const page = Math.min(q.page, pages);
  const shown = products.slice((page - 1) * PAGE_SIZE.products, page * PAGE_SIZE.products);
  const owner = user.role === "owner";
  const small = "flex flex-col gap-1 text-xs text-text-muted";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <PageHeader title={t("admin.products.title")}>
        {owner && (
          <Link href="/admin/products/new" className={buttonClass()}>
            {t("admin.products.new")}
          </Link>
        )}
      </PageHeader>
      {!owner && <p className="text-sm text-text-muted">{t("admin.products.staffHint")}</p>}

      <nav aria-label={t("admin.common.filter")} className="flex gap-2">
        {[
          { label: t("admin.products.live"), archived: undefined },
          { label: t("admin.products.archivedTab"), archived: "1" },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={`/admin/products${withQuery(q, { archived: tab.archived, page: undefined })}`}
            aria-current={q.archived === tab.archived ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm",
              q.archived === tab.archived ? "border-text bg-inverse text-inverse-fg" : "border-border",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form
        role="search"
        className={cn("grid grid-cols-2 gap-2", multiCategory ? "md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]" : "md:grid-cols-[2fr_1fr_1fr_auto_auto]")}
      >
        {q.archived && <input type="hidden" name="archived" value="1" />}
        <label className="col-span-2 md:col-span-1">
          <span className="sr-only">{t("admin.common.search")}</span>
          <input name="search" type="search" defaultValue={q.search} placeholder={t("admin.products.searchPlaceholder")} className={inputClass()} />
        </label>
        {multiCategory && (
          <label>
            <span className="sr-only">{t("admin.products.editor.category")}</span>
            <select name="category" defaultValue={q.category ?? ""} className={inputClass()}>
              <option value="">{t("admin.products.allCategories")}</option>
              {storeConfig.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">{t("admin.products.editor.brand")}</span>
          <select name="brand" defaultValue={q.brand ?? ""} className={inputClass()}>
            <option value="">{t("admin.products.allBrands")}</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("admin.products.editor.condition")}</span>
          <select name="condition" defaultValue={q.condition ?? ""} className={inputClass()}>
            <option value="">{t("admin.products.allConditions")}</option>
            <option value="new">{t("admin.products.editor.new")}</option>
            <option value="used">{t("admin.products.editor.used")}</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={q.lowStock === "1"} className="size-5" />
          {t("admin.products.lowStock")}
        </label>
        <button type="submit" className={buttonClass()}>
          {t("admin.products.apply")}
        </button>
      </form>

      <p role="status" className="text-sm text-text-muted">
        {t("admin.products.results", { n: products.length })}
      </p>

      {products.length === 0 ? (
        <p className="rounded-lg border border-border p-5 text-center text-text-muted">{t("admin.products.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {shown.map((p) => {
            const low = p.variants.some((v) => v.stockQty <= LOW);
            return (
              <li key={p.id}>
                <details open={Boolean(q.search || q.lowStock)} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-surface-alt">
                    <Image src={p.images[0]} alt="" width={48} height={48} className="size-12 shrink-0 rounded-sm bg-surface-alt object-contain" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="text-sm text-text-muted">
                        {p.brand}
                        {p.condition === "used" && ` · ${t("admin.products.editor.used")}`} ·{" "}
                        {t("admin.products.variants", { n: p.variants.length, stock: totalStock(p) })}
                      </span>
                    </span>
                    {low && <Badge tone="warning">{t("product.lowStock")}</Badge>}
                    <span aria-hidden className="text-text-muted transition-transform group-open:rotate-90">›</span>
                  </summary>

                  <div className="flex flex-col gap-3 border-t border-border bg-surface-alt px-3 pt-2 pb-3">
                    <ul className="flex flex-col divide-y divide-border">
                      {p.variants.map((v) => (
                        <li key={v.sku}>
                          <ActionForm action={saveVariant} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 py-2 md:grid-cols-[1fr_auto_auto_auto]">
                            <input type="hidden" name="sku" value={v.sku} />
                            <input type="hidden" name="stockWas" value={v.stockQty} />
                            <span className="col-span-full flex min-w-0 flex-col self-center text-sm md:col-span-1">
                              <span className="flex items-center gap-1">
                                <span aria-hidden className="size-3 shrink-0 rounded-pill border border-border" style={{ background: v.color.hex }} />
                                {variantLabel(v.color.name, v.storage)}
                              </span>
                              <span className={cn("text-xs", v.stockQty === 0 ? "text-danger" : v.stockQty <= LOW ? "text-warning" : "text-text-muted")}>
                                {v.sku}
                              </span>
                            </span>
                            {owner ? (
                              <label className={cn(small, "md:w-28")}>
                                {t("admin.products.price")}
                                <input type="hidden" name="base" value={p.basePrice} />
                                <input name="price" inputMode="numeric" pattern="\d*" defaultValue={variantPrice(p, v)} className={inputClass()} />
                              </label>
                            ) : (
                              <span />
                            )}
                            <label className={cn(small, "md:w-20")}>
                              {t("admin.products.stock")}
                              <input name="stock" type="number" min={0} required defaultValue={v.stockQty} className={inputClass()} />
                            </label>
                            <SubmitButton variant="secondary" pendingLabel="…">
                              {t("admin.products.saveRow")}
                            </SubmitButton>
                          </ActionForm>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      {owner && (
                        <>
                          <Link href={`/admin/products/${p.id}`} className={buttonClass()}>
                            {t("admin.products.edit")}
                          </Link>
                          <Link href={`/admin/products/new?from=${p.id}`} className={buttonClass({ variant: "secondary" })}>
                            {t("admin.products.duplicate")}
                          </Link>
                          <ActionForm action={setArchived}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="archived" value={p.archivedAt ? "0" : "1"} />
                            <SubmitButton variant="ghost">{t(p.archivedAt ? "admin.products.restore" : "admin.products.archive")}</SubmitButton>
                          </ActionForm>
                        </>
                      )}
                      {!p.archivedAt && (
                        <Link href={`/product/${p.slug}`} target="_blank" className={buttonClass({ variant: "ghost" })}>
                          {t("admin.products.view")} ↗
                        </Link>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <Pager path="/admin/products" q={{ ...q, page }} pages={pages} />
    </div>
  );
}
