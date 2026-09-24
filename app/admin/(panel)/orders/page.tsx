import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Pager } from "@/components/admin/Pager";
import { RefreshOnFocus } from "@/components/admin/RefreshOnFocus";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { orderQuerySchema, PAGE_SIZE, withQuery } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/data/schemas";
import { formatDate, formatPrice, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("admin.orders.title") };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { admin } = await requireRole();
  const q = orderQuerySchema.parse(await searchParams);
  const { rows, total, counts } = await admin.listOrders({ ...q, pageSize: PAGE_SIZE.orders });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE.orders));
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = [{ status: undefined, label: t("admin.orders.all"), n: all }, ...ORDER_STATUSES.map((s) => ({ status: s, label: t(`status.${s}`), n: counts[s] }))];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <RefreshOnFocus />
      <PageHeader title={t("admin.orders.title")}>
        <a href={`/admin/orders/export${withQuery(q, { page: undefined })}`} className={buttonClass({ variant: "secondary" })} download>
          {t("admin.common.exportCsv")}
        </a>
      </PageHeader>

      <nav aria-label={t("admin.common.filter")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <Link
                href={`/admin/orders${withQuery(q, { status: tab.status, page: undefined })}`}
                aria-current={q.status === tab.status ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm whitespace-nowrap",
                  q.status === tab.status ? "border-text bg-inverse text-inverse-fg" : "border-border",
                )}
              >
                {tab.label} <span className="tabular-nums opacity-75">{tab.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_auto_auto_auto]" role="search">
        {q.status && <input type="hidden" name="status" value={q.status} />}
        <label className="col-span-2 md:col-span-1">
          <span className="sr-only">{t("admin.orders.searchLabel")}</span>
          <input name="search" type="search" defaultValue={q.search} placeholder={t("admin.orders.searchPlaceholder")} className={inputClass()} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm md:flex-row md:items-center md:gap-2">
          {t("admin.orders.from")}
          <input name="from" type="date" defaultValue={q.from} className={cn(inputClass(), "min-w-0")} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm md:flex-row md:items-center md:gap-2">
          {t("admin.orders.to")}
          <input name="to" type="date" defaultValue={q.to} className={cn(inputClass(), "min-w-0")} />
        </label>
        <button type="submit" className={buttonClass({ className: "col-span-2 md:col-span-1" })}>
          {t("admin.orders.apply")}
        </button>
      </form>

      <p className="text-sm text-text-muted" role="status">
        {t("admin.orders.results", { n: total })}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border p-5 text-center text-text-muted">{t("admin.orders.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="flex flex-col gap-1 p-4 hover:bg-surface-alt">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{o.id}</span>
                  <StatusBadge status={o.status} />
                  <span className="ms-auto font-semibold tabular-nums">{formatPrice(o.totals.total)}</span>
                </span>
                <span>
                  {o.customer.name} <span className="text-text-muted">· {o.customer.phone}</span>
                </span>
                <span className="text-sm text-text-muted">
                  {formatDate(o.createdAt)} · {t(o.fulfillment === "delivery" ? "admin.orders.delivery" : "admin.orders.pickup")}
                  {o.customer.wilaya && ` · ${o.customer.wilaya}`}
                </span>
                <span className="truncate text-sm">{o.items.map((i) => `${i.qty} × ${i.label}`).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pager path="/admin/orders" q={q} pages={pages} />
    </div>
  );
}
