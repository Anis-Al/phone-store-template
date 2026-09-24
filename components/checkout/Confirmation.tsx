"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { useHydrated } from "@/lib/cart";
import { storeConfig } from "@/lib/config/store.config";
import { orderSchema, type Order } from "@/lib/data/schemas";
import { formatPrice, t } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";
import { LAST_ORDER_KEY } from "./CheckoutForm";

function readOrder(ref: string): Order | null {
  try {
    const o = orderSchema.safeParse(JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) ?? "null"));
    return o.success && o.data.id === ref ? o.data : null;
  } catch {
    return null;
  }
}

export function waSummary(o: Order) {
  const store = storeConfig.identity.name;
  return [
    t("confirmation.waHello", { store, ref: o.id }),
    ...o.items.map((i) => `• ${i.qty}× ${i.label} — ${formatPrice(i.unitPrice * i.qty)}`),
    o.fulfillment === "delivery"
      ? t("confirmation.waDelivery", { wilaya: o.customer.wilaya ?? "", address: o.customer.address ?? "" })
      : t("confirmation.waPickup"),
    t("confirmation.waTotal", { total: formatPrice(o.totals.total) }),
    t("confirmation.waName", { name: o.customer.name }),
  ].join("\n");
}

export function Confirmation() {
  const ref = useSearchParams().get("ref") ?? "";
  // sessionStorage only: the order (with PII) is never fetchable by ref from the server.
  const order = useHydrated() ? readOrder(ref) : null;
  const text = order ? waSummary(order) : t("confirmation.waHello", { store: storeConfig.identity.name, ref });

  return (
    <div className="mx-auto max-w-2xl text-center">
      <CheckCircle2 aria-hidden size={56} className="mx-auto text-success" />
      <h1 className="mt-4 text-3xl font-semibold md:text-5xl">{t("confirmation.title")}</h1>
      <p className="mt-5 text-sm text-text-muted">{t("confirmation.ref")}</p>
      <p className="text-3xl font-semibold tracking-wide tabular-nums">{ref}</p>

      {order && (
        <>
          <p className="mt-5 text-text-muted">
            {t(order.fulfillment === "delivery" ? "confirmation.nextDelivery" : "confirmation.nextPickup", {
              phone: order.customer.phone,
            })}
          </p>
          <ul className="mt-5 divide-y divide-border rounded-lg bg-surface-alt px-5 text-start text-sm">
            {order.items.map((i) => (
              <li key={i.sku} className="flex justify-between gap-3 py-3">
                <span>
                  {i.qty} × {i.label}
                </span>
                <span className="tabular-nums">{formatPrice(i.unitPrice * i.qty)}</span>
              </li>
            ))}
            {order.totals.deliveryFee > 0 && (
              <li className="flex justify-between gap-3 py-3">
                <span>{t("checkout.deliveryFee")}</span>
                <span className="tabular-nums">{formatPrice(order.totals.deliveryFee)}</span>
              </li>
            )}
            <li className="flex justify-between gap-3 py-3 text-base font-semibold">
              <span>{t("checkout.total")}</span>
              <span className="tabular-nums">{formatPrice(order.totals.total)}</span>
            </li>
          </ul>
        </>
      )}

      <p className="mt-7 text-sm text-text-muted">{t("confirmation.whatsappHint")}</p>
      <div className="mt-3 flex flex-col items-center gap-3">
        <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "lg" })}>
          <MessageCircle aria-hidden size={20} /> {t("confirmation.whatsapp")}
        </a>
        <Link href="/catalog" className={buttonClass({ variant: "ghost" })}>
          {t("confirmation.back")}
        </Link>
      </div>
    </div>
  );
}
