import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pager } from "@/components/admin/Pager";
import { StockImport } from "@/components/admin/StockImport";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { PAGE_SIZE, stockQuerySchema } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { formatDate, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { adjustStock, applyImport, previewImport } from "./actions";

export const metadata: Metadata = { title: t("admin.stock.title") };

const REASONS = ["order", "cancel", "manual", "import", "edit"] as const;

export default async function StockPage({ searchParams }: PageProps<"/admin/stock">) {
  const { user, admin } = await requireRole();
  const q = stockQuerySchema.parse(await searchParams);
  const [{ rows, total }, variants] = await Promise.all([admin.stockMovements({ ...q, pageSize: PAGE_SIZE.stock }), admin.listVariants()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE.stock));
  const box = "flex flex-col gap-3 rounded-lg border border-border p-4";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-5 md:px-6">
      <PageHeader title={t("admin.stock.title")}>
        <a href="/admin/stock/export" download className={buttonClass({ variant: "secondary" })}>
          {t("admin.stock.exportVariants")}
        </a>
      </PageHeader>

      <section className={box} aria-labelledby="adjust">
        <h2 id="adjust" className="text-xl font-semibold">{t("admin.stock.adjust")}</h2>
        <p className="text-sm text-text-muted">{t("admin.stock.adjustHint")}</p>
        <ActionForm action={adjustStock} className="grid grid-cols-2 items-end gap-2 md:grid-cols-[1fr_8rem_1fr_auto]">
          <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold md:col-span-1">
            {t("admin.stock.sku")}
            <input name="sku" list="skus" required autoCapitalize="characters" className={inputClass()} />
          </label>
          <datalist id="skus">
            {variants.map((v) => (
              <option key={v.sku} value={v.sku}>{`${v.product} · ${v.color} · ${v.stock}`}</option>
            ))}
          </datalist>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("admin.stock.delta")}
            <input name="delta" type="number" required step={1} className={inputClass()} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("admin.stock.note")}
            <input name="note" required minLength={3} maxLength={200} className={inputClass()} />
          </label>
          <SubmitButton>{t("admin.stock.apply")}</SubmitButton>
        </ActionForm>
      </section>

      {user.role === "owner" && (
        <section className={box} aria-labelledby="import">
          <h2 id="import" className="text-xl font-semibold">{t("admin.stock.import")}</h2>
          <p className="text-sm text-text-muted">{t("admin.stock.importHint")}</p>
          <StockImport preview={previewImport} apply={applyImport} />
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="log">
        <h2 id="log" className="text-xl font-semibold">{t("admin.stock.log")}</h2>
        <form role="search" className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="sr-only">{t("admin.stock.skuFilter")}</span>
            <input name="sku" type="search" defaultValue={q.sku} placeholder={t("admin.stock.skuFilter")} className={inputClass()} />
          </label>
          <label>
            <span className="sr-only">{t("admin.stock.why")}</span>
            <select name="reason" defaultValue={q.reason ?? ""} className={inputClass()}>
              <option value="">{t("admin.stock.allReasons")}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`admin.stock.reason.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass({ className: "col-span-2 md:col-span-1" })}>
            {t("admin.common.filter")}
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-border p-5 text-center text-text-muted">{t("admin.stock.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
            {rows.map((m) => (
              <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-semibold">{m.sku}</span>
                <span className={cn("text-end font-semibold tabular-nums", m.delta < 0 ? "text-danger" : "text-success")}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                <span className="col-span-2 text-text-muted">
                  {formatDate(m.createdAt)} · {t(`admin.stock.reason.${m.reason}`)}
                  {m.orderId && (
                    <>
                      {" · "}
                      <Link href={`/admin/orders/${m.orderId}`} className="text-primary">
                        {m.orderId}
                      </Link>
                    </>
                  )}
                  {m.userName && ` · ${m.userName}`}
                  {m.note && <span className="block text-text">« {m.note} »</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Pager path="/admin/stock" q={q} pages={pages} />
      </section>
    </div>
  );
}
