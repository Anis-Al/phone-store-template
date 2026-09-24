import { storeConfig } from "@/lib/config/store.config";
import type { Order } from "@/lib/data/schemas";
import { formatDate, formatPrice, fulfillmentLabel, t } from "@/lib/i18n";

/** The printed order slip ("bon"): the order page prints one, /admin/orders/print a batch. No status, no internal note. */
export function OrderSlip({ order }: { order: Order }) {
  const { identity, contact } = storeConfig;
  const c = order.customer;
  return (
    <article className="flex flex-col gap-4 text-text">
      <header className="flex flex-wrap justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="text-xl font-semibold">{identity.name}</p>
          <p className="text-sm">
            {contact.address.street}, {contact.address.city} · {contact.phone}
          </p>
        </div>
        <div className="text-end">
          <p className="text-sm">{t("admin.orders.slip")}</p>
          <p className="text-2xl font-semibold">{order.id}</p>
          <p className="text-sm">{formatDate(order.createdAt)}</p>
        </div>
      </header>
      <section>
        <h2 className="font-semibold">{t("admin.orders.customer")}</h2>
        <p>
          {c.name} · <span className="tabular-nums">{c.phone}</span>
        </p>
        <p>
          {fulfillmentLabel(order)}
          {c.wilaya && ` — ${c.wilaya}, ${c.address}`}
        </p>
        <p className="text-sm">
          {t("admin.orders.payment")} : {t(order.paymentMethod === "cod" ? "admin.orders.cod" : "admin.orders.instore")}
        </p>
      </section>
      <section>
        <h2 className="font-semibold">{t("admin.orders.items")}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.sku} className="flex justify-between gap-3 py-2">
              <span>
                {i.qty} × {i.label}
                <span className="block text-xs">{i.sku}</span>
              </span>
              <span className="tabular-nums whitespace-nowrap">{formatPrice(i.qty * i.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[1fr_auto] gap-1 border-t border-border pt-3 text-sm">
          <dt>{t("admin.orders.subtotal")}</dt>
          <dd className="text-end tabular-nums">{formatPrice(order.totals.subtotal)}</dd>
          <dt>{t("admin.orders.deliveryFee")}</dt>
          <dd className="text-end tabular-nums">{formatPrice(order.totals.deliveryFee)}</dd>
          <dt className="text-base font-semibold">{t("admin.orders.total")}</dt>
          <dd className="text-end text-base font-semibold tabular-nums">{formatPrice(order.totals.total)}</dd>
        </dl>
      </section>
    </article>
  );
}
