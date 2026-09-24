import type { Metadata } from "next";
import Link from "next/link";
import { OrderSlip } from "@/components/admin/OrderSlip";
import { PrintButton } from "@/components/admin/PrintButton";
import { orderQuerySchema, PAGE_SIZE, withQuery } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("admin.orders.printTitle") };

/** Every slip of the list's current filter (e.g. ?status=ready before the delivery run), one per printed page. */
export default async function PrintOrdersPage({ searchParams }: PageProps<"/admin/orders/print">) {
  const { admin } = await requireRole();
  const q = orderQuerySchema.parse(await searchParams);
  // ponytail: one page of PAGE_SIZE.print slips; paginate if a store ever prints more at once.
  const { rows, total } = await admin.listOrders({ ...q, page: 1, pageSize: PAGE_SIZE.print });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 md:px-6 print:p-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/admin/orders${withQuery(q, { page: undefined })}`} className="inline-flex min-h-11 items-center text-primary">
          ← {t("admin.orders.back")}
        </Link>
        <p className="ms-auto text-sm text-text-muted">
          {t("admin.orders.printCount", { n: rows.length })}
          {total > rows.length && ` · ${t("admin.orders.printCapped", { n: total })}`}
        </p>
        {rows.length > 0 && <PrintButton label={t("admin.orders.printNow")} />}
      </div>
      {rows.length === 0 && <p className="rounded-lg border border-border p-5 text-center text-text-muted">{t("admin.orders.empty")}</p>}
      {rows.map((o) => (
        <div key={o.id} className="break-after-page rounded-lg border border-border p-4 last:break-after-auto print:rounded-none print:border-0 print:p-0">
          <OrderSlip order={o} />
        </div>
      ))}
    </div>
  );
}
