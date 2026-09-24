import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { PrintButton } from "@/components/admin/PrintButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requireRole } from "@/lib/auth";
import { storeConfig } from "@/lib/config/store.config";
import type { OrderStatus } from "@/lib/data/schemas";
import { formatDate, formatPrice, t } from "@/lib/i18n";
import { dzPhoneIntl, NEXT_STATUS } from "@/lib/order";
import { saveNote, setStatus } from "../actions";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  return { title: (await params).id };
}

const box = "flex flex-col gap-3 rounded-lg border border-border p-4";

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { admin } = await requireRole();
  const id = decodeURIComponent((await params).id);
  const order = await admin.getOrder(id);
  if (!order) notFound();
  const history = await admin.audit("order", order.id);

  const { contact, identity } = storeConfig;
  const wa = order.status === "ready" ? (order.fulfillment === "pickup" ? "readyPickup" : "readyDelivery") : order.status;
  const waText = t(`admin.orders.wa.${wa}`, {
    name: order.customer.name,
    ref: order.id,
    store: identity.name,
    total: formatPrice(order.totals.total),
    address: `${contact.address.street}, ${contact.address.city}`,
  });
  const next = NEXT_STATUS[order.status];
  const label = (s: OrderStatus) => t(`status.${s}`);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <Link href="/admin/orders" className="inline-flex min-h-11 items-center self-start text-primary print:hidden">
        ← {t("admin.orders.back")}
      </Link>

      {/* printed slip header */}
      <div className="hidden print:block">
        <p className="text-xl font-semibold">{identity.name}</p>
        <p>
          {contact.address.street}, {contact.address.city} · {contact.phone}
        </p>
        <p className="mt-3 text-sm">{t("admin.orders.slip")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{order.id}</h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-text-muted">{formatDate(order.createdAt)}</span>
      </div>

      <section className={box} aria-labelledby="customer">
        <h2 id="customer" className="font-semibold">{t("admin.orders.customer")}</h2>
        <p>
          {order.customer.name}
          <br />
          <span className="tabular-nums">{order.customer.phone}</span>
        </p>
        <p>
          <span className="font-semibold">{t(order.fulfillment === "delivery" ? "admin.orders.delivery" : "admin.orders.pickup")}</span>
          {order.customer.wilaya && (
            <>
              <br />
              {order.customer.wilaya} — {order.customer.address}
            </>
          )}
          <br />
          <span className="text-sm text-text-muted">
            {t("admin.orders.payment")} : {t(order.paymentMethod === "cod" ? "admin.orders.cod" : "admin.orders.instore")}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={`tel:${order.customer.phone}`} className={buttonClass()}>
            <Phone className="size-5" aria-hidden />
            {t("admin.orders.call")}
          </a>
          <a
            href={`https://wa.me/${dzPhoneIntl(order.customer.phone)}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "secondary" })}
          >
            <MessageCircle className="size-5" aria-hidden />
            {t("admin.orders.whatsapp")}
          </a>
          <PrintButton label={t("admin.orders.print")} />
        </div>
      </section>

      <section className={box} aria-labelledby="items">
        <h2 id="items" className="font-semibold">{t("admin.orders.items")}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.sku} className="flex justify-between gap-3 py-2">
              <span>
                {i.qty} × {i.label}
                <span className="block text-xs text-text-muted">{i.sku}</span>
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

      <section className={`${box} print:hidden`} aria-labelledby="status">
        <h2 id="status" className="font-semibold">{t("admin.orders.status")}</h2>
        {next.length === 0 ? (
          <p className="text-sm text-text-muted">{t("admin.orders.final")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {next
                .filter((s) => s !== "cancelled")
                .map((s) => (
                  <ActionForm key={s} action={setStatus}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="next" value={s} />
                    <SubmitButton>{t("admin.orders.moveTo", { status: label(s) })}</SubmitButton>
                  </ActionForm>
                ))}
            </div>
            {next.includes("cancelled") && (
              <details className="rounded-md border border-border">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-danger">{t("admin.orders.cancel")}</summary>
                <ActionForm action={setStatus} className="flex flex-col gap-2 p-3">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="next" value="cancelled" />
                  <label htmlFor="reason" className="text-sm font-semibold">
                    {t("admin.orders.cancelReason")}
                  </label>
                  <textarea id="reason" name="note" required minLength={3} maxLength={500} rows={2} className={inputClass()} />
                  <p className="text-sm text-text-muted">{t("admin.orders.cancelHint")}</p>
                  <div>
                    <SubmitButton variant="secondary">{t("admin.orders.cancelConfirm")}</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            )}
          </>
        )}
      </section>

      <section className={box} aria-labelledby="note">
        <h2 id="note" className="font-semibold">{t("admin.orders.note")}</h2>
        <p className="hidden whitespace-pre-line print:block">{order.note}</p>
        <ActionForm action={saveNote} className="flex flex-col gap-2 print:hidden">
          <input type="hidden" name="id" value={order.id} />
          <label htmlFor="note-text" className="sr-only">
            {t("admin.orders.note")}
          </label>
          <textarea
            id="note-text"
            name="note"
            defaultValue={order.note}
            maxLength={2000}
            rows={3}
            placeholder={t("admin.orders.notePlaceholder")}
            className={inputClass()}
          />
          <div>
            <SubmitButton variant="secondary">{t("admin.orders.saveNote")}</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className={`${box} print:hidden`} aria-labelledby="timeline">
        <h2 id="timeline" className="font-semibold">{t("admin.orders.timeline")}</h2>
        <ol className="flex flex-col gap-2 text-sm">
          <li>
            <span className="text-text-muted">{formatDate(order.createdAt)}</span> — {t("admin.orders.created")}
          </li>
          {history.map((h) => {
            const d = (h.diff ?? {}) as { from?: OrderStatus; to?: OrderStatus; note?: string };
            return (
              <li key={h.id}>
                <span className="text-text-muted">{formatDate(h.createdAt)}</span> —{" "}
                {h.action === "status" && d.from && d.to
                  ? t("admin.orders.statusChanged", { from: label(d.from), to: label(d.to) })
                  : t("admin.orders.noteChanged")}
                {h.userName && <span className="text-text-muted"> · {h.userName}</span>}
                {d.note && h.action === "status" && <span className="block text-text-muted">« {d.note} »</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
