import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { requireRole } from "@/lib/auth";
import { storeConfig } from "@/lib/config/store.config";
import { formatPrice, t, variantLabel } from "@/lib/i18n";
import { canEdit } from "@/lib/order";
import { deskEnabled, wilayas } from "@/lib/wilayas";
import { saveOrder } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]/edit">): Promise<Metadata> {
  return { title: t("admin.orders.editTitle", { ref: decodeURIComponent((await params).id) }) };
}

const box = "flex flex-col gap-3 rounded-lg border border-border p-4";

export default async function EditOrderPage({ params }: PageProps<"/admin/orders/[id]/edit">) {
  const { admin } = await requireRole();
  const order = await admin.getOrder(decodeURIComponent((await params).id));
  if (!order) notFound();
  if (!canEdit(order.status)) redirect(`/admin/orders/${order.id}`);
  const variants = (await admin.listVariants()).filter((v) => v.stock > 0);

  const { commerce } = storeConfig;
  const c = order.customer;
  const mode = order.fulfillment === "pickup" ? "pickup" : c.desk ? "desk" : "delivery";
  const modes = (["delivery", "desk", "pickup"] as const).filter((m) =>
    m === "pickup" ? commerce.pickupEnabled : m === "desk" ? deskEnabled : commerce.deliveryEnabled,
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 md:px-6">
      <Link href={`/admin/orders/${order.id}`} className="inline-flex min-h-11 items-center self-start text-primary">
        ← {t("admin.orders.backToOrder")}
      </Link>
      <h1 className="text-3xl font-semibold">{t("admin.orders.editTitle", { ref: order.id })}</h1>

      <ActionForm action={saveOrder} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={order.id} />
        <input type="hidden" name="was" value={order.updatedAt ?? ""} />

        <section className={box} aria-labelledby="items">
          <h2 id="items" className="font-semibold">{t("admin.orders.items")}</h2>
          <ul className="flex flex-col divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.sku} className="flex items-center justify-between gap-3 py-2">
                <label htmlFor={`qty-${i.sku}`} className="min-w-0">
                  {i.label}
                  <span className="block text-xs text-text-muted">
                    {i.sku} · {formatPrice(i.unitPrice)}
                  </span>
                </label>
                <div className="w-20 shrink-0">
                  <input
                    id={`qty-${i.sku}`}
                    name={`qty:${i.sku}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    required
                    defaultValue={i.qty}
                    className={inputClass()}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">{t("admin.orders.qtyHint")}</p>
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field id="addSku" label={t("admin.orders.addItem")}>
                <input id="addSku" name="addSku" list="variants" autoComplete="off" placeholder={t("admin.orders.addPlaceholder")} className={inputClass()} />
              </Field>
            </div>
            <div className="w-20 shrink-0">
              <label htmlFor="addQty" className="sr-only">
                {t("admin.orders.addQty")}
              </label>
              <input id="addQty" name="addQty" type="number" inputMode="numeric" min={1} max={99} defaultValue={1} className={inputClass()} />
            </div>
          </div>
          {/* ponytail: native <datalist>, fine for a few hundred SKUs; a search endpoint if a store ever has thousands. */}
          <datalist id="variants">
            {variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {`${v.product} · ${variantLabel(v.color, v.storage)} — ${formatPrice(v.price)} · ${t("product.stockCount", { n: v.stock })}`}
              </option>
            ))}
          </datalist>
        </section>

        <section className={box} aria-labelledby="customer">
          <h2 id="customer" className="font-semibold">{t("admin.orders.customer")}</h2>
          <Field id="name" label={t("checkout.name")}>
            <input id="name" name="name" required defaultValue={c.name} autoComplete="off" className={inputClass()} />
          </Field>
          <Field id="phone" label={t("checkout.phone")}>
            <input id="phone" name="phone" type="tel" inputMode="tel" required defaultValue={c.phone} autoComplete="off" className={inputClass()} />
          </Field>
          <Field id="fulfillment" label={t("checkout.fulfillment")}>
            <select id="fulfillment" name="fulfillment" defaultValue={mode} className={inputClass()}>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {t(`checkout.${m}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="wilaya" label={t("checkout.wilaya")}>
            <select id="wilaya" name="wilaya" defaultValue={c.wilaya?.split(" - ")[0] ?? ""} className={inputClass()}>
              <option value="">—</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="address" label={`${t("checkout.address")} / ${t("checkout.commune")}`}>
            <textarea id="address" name="address" rows={2} defaultValue={c.address} className={inputClass()} />
          </Field>
          <p className="text-xs text-text-muted">{t("admin.orders.feeHint")}</p>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton>{t("admin.common.save")}</SubmitButton>
          <Link href={`/admin/orders/${order.id}`} className={buttonClass({ variant: "ghost" })}>
            {t("admin.common.cancel")}
          </Link>
        </div>
      </ActionForm>
    </div>
  );
}
