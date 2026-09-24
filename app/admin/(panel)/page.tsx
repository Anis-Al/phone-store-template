import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireRole } from "@/lib/auth";
import { formatPrice, t, variantLabel } from "@/lib/i18n";

export const metadata: Metadata = { title: t("admin.dashboard.title") };

const card = "flex flex-col gap-2 rounded-lg border border-border p-4";

export default async function DashboardPage() {
  const { admin } = await requireRole();
  const d = await admin.dashboard();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-5 md:px-6">
      <PageHeader title={t("admin.dashboard.title")} />

      <section aria-labelledby="todo" className="flex flex-col gap-3">
        <h2 id="todo" className="text-xl font-semibold">{t("admin.dashboard.todo")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/admin/orders?status=new" className={card}>
            <span className="text-4xl font-semibold tabular-nums">{d.newOrders}</span>
            <span className="text-primary">{t("admin.dashboard.toCall")} →</span>
          </Link>
          <Link href="/admin/orders?status=ready" className={card}>
            <span className="text-4xl font-semibold tabular-nums">{d.readyOrders}</span>
            <span className="text-primary">{t("admin.dashboard.toHandOver")} →</span>
          </Link>
          <div className={card}>
            <h3 className="font-semibold">{t("admin.dashboard.lowStock")}</h3>
            {d.lowStock.length === 0 ? (
              <p className="text-sm text-text-muted">{t("admin.dashboard.noLowStock")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {d.lowStock.slice(0, 6).map((v) => (
                  <li key={v.sku} className="flex justify-between gap-2">
                    <Link href={`/admin/products?search=${encodeURIComponent(v.sku)}`} className="truncate text-primary">
                      {v.product} · {variantLabel(v.color, v.storage)}
                    </Link>
                    <span className={v.stock === 0 ? "text-danger" : "text-warning"}>{v.stock}</span>
                  </li>
                ))}
              </ul>
            )}
            {d.lowStock.length > 6 && (
              <Link href="/admin/products?lowStock=1" className="text-sm text-primary">
                {t("admin.dashboard.seeAll")} ({d.lowStock.length}{d.lowStock.length === 20 ? "+" : ""}) →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="activity" className="flex flex-col gap-3">
        <h2 id="activity" className="text-xl font-semibold">{t("admin.dashboard.activity")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {([["last7", d.last7], ["last30", d.last30]] as const).map(([k, s]) => (
            <div key={k} className={card}>
              <span className="text-sm text-text-muted">{t(`admin.dashboard.${k}`)}</span>
              <span className="text-2xl font-semibold tabular-nums">{formatPrice(s.revenue)}</span>
              <span className="text-sm">{t("admin.dashboard.orders", { n: s.orders })}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-text-muted">{t("admin.dashboard.revenueHint")}</p>
      </section>

      <section aria-labelledby="top" className="flex flex-col gap-3">
        <h2 id="top" className="text-xl font-semibold">{t("admin.dashboard.topSkus")}</h2>
        {d.topSkus.length === 0 ? (
          <p className="text-text-muted">{t("admin.dashboard.noSales")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-start text-text-muted">
              <tr>
                <th scope="col" className="py-2 text-start font-normal">SKU</th>
                <th scope="col" className="py-2 text-end font-normal">{t("admin.dashboard.qty")}</th>
                <th scope="col" className="py-2 text-end font-normal">{t("admin.dashboard.revenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.topSkus.map((s) => (
                <tr key={s.sku}>
                  <td className="py-2">
                    {s.label}
                    <span className="block text-xs text-text-muted">{s.sku}</span>
                  </td>
                  <td className="py-2 text-end tabular-nums">{s.qty}</td>
                  <td className="py-2 text-end tabular-nums">{formatPrice(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
