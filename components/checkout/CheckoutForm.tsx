"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cartSubtotal, useCart, useHydrated } from "@/lib/cart";
import { storeConfig } from "@/lib/config/store.config";
import type { Order } from "@/lib/data/schemas";
import { dayRange, formatPrice, t, type TKey } from "@/lib/i18n";
import { checkoutFormSchema, deliveryFee } from "@/lib/order";
import { deskEnabled, feeFrom, wilayas } from "@/lib/wilayas";

type In = z.input<typeof checkoutFormSchema>;
type Out = z.output<typeof checkoutFormSchema>;

export const LAST_ORDER_KEY = "last-order";

const API_ERRORS: Record<string, TKey> = {
  rate_limited: "errors.rateLimited",
  out_of_stock: "errors.stock",
  unknown_sku: "errors.stock",
};

export function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const stored = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const [placed, setPlaced] = useState(false);
  const { commerce, contact, identity } = storeConfig;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(checkoutFormSchema),
    mode: "onTouched",
    defaultValues: { fulfillment: commerce.deliveryEnabled ? "delivery" : "pickup", name: "", phone: "", wilaya: "", address: "" },
  });

  const lines = hydrated ? stored : [];
  const mode = useWatch({ control, name: "fulfillment" });
  const delivery = mode !== "pickup";
  const desk = mode === "desk";
  const wilayaCode = useWatch({ control, name: "wilaya" });
  const wilaya = wilayas.find((w) => w.code === wilayaCode);
  const subtotal = cartSubtotal(lines);
  const fee = delivery && wilaya ? (deliveryFee(commerce.deliveryFees, wilaya, desk) ?? 0) : 0;
  const feeKnown = !delivery || !!wilaya; // the server re-computes it anyway
  const err = (k: keyof In) => (errors[k]?.message ? t(errors[k].message as TKey) : undefined);
  const aria = (k: keyof In, hint?: boolean) => ({
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${k}-error` : hint ? `${k}-hint` : undefined,
  });

  const onSubmit = async (values: Out) => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, items: lines.map(({ sku, qty }) => ({ sku, qty })) }),
      });
      const data = (await res.json()) as { order?: Order; error?: string };
      if (!res.ok || !data.order) {
        return setError("root", { message: t(API_ERRORS[data.error ?? ""] ?? "errors.generic") });
      }
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(data.order));
      setPlaced(true);
      clear();
      router.push(`/confirmation?ref=${encodeURIComponent(data.order.id)}`);
    } catch {
      setError("root", { message: t("errors.generic") });
    }
  };

  if (!hydrated) return <div className="min-h-96" aria-busy />;
  if (!lines.length && !placed)
    return (
      <div className="rounded-lg bg-surface-alt px-5 py-8 text-center">
        <p className="text-text-muted">{t("checkout.emptyCart")}</p>
        <Link href="/catalog" className={buttonClass({ variant: "secondary", className: "mt-5" })}>
          {t("cart.continue")}
        </Link>
      </div>
    );

  const modes = [
    commerce.deliveryEnabled && {
      value: "delivery",
      icon: Truck,
      label: t("checkout.delivery"),
      hint: t("checkout.deliveryHint", { fee: feeFrom(false) }),
    },
    deskEnabled && { value: "desk", icon: Building2, label: t("checkout.desk"), hint: t("checkout.deskHint", { fee: feeFrom(true) }) },
    commerce.pickupEnabled && { value: "pickup", icon: Store, label: t("checkout.pickup"), hint: t("checkout.pickupHint") },
  ].filter((m) => !!m);

  return (
    <form data-hide-fab onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-7 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-7">
        <fieldset>
          <legend className="text-xl font-semibold">{t("checkout.fulfillment")}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {modes.map((m) => (
              <label
                key={m.value}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border-2 border-border p-4 has-checked:border-primary has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input type="radio" value={m.value} {...register("fulfillment")} className="sr-only" />
                <m.icon aria-hidden size={22} />
                <span>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="block text-sm text-text-muted">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-xl font-semibold">{t("checkout.contact")}</legend>
          <Field id="name" label={t("checkout.name")} error={err("name")}>
            <input id="name" autoComplete="name" {...register("name")} {...aria("name")} className={inputClass(!!errors.name)} />
          </Field>
          <Field id="phone" label={t("checkout.phone")} error={err("phone")} hint={t("checkout.phoneHint")}>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0555 12 34 56"
              {...register("phone")}
              {...aria("phone", true)}
              className={inputClass(!!errors.phone)}
            />
          </Field>
          {delivery && (
            <>
              <Field id="wilaya" label={t("checkout.wilaya")} error={err("wilaya")}>
                <select id="wilaya" {...register("wilaya")} {...aria("wilaya")} className={inputClass(!!errors.wilaya)}>
                  <option value="">{t("checkout.wilayaPlaceholder")}</option>
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} - {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="address"
                label={t(desk ? "checkout.commune" : "checkout.address")}
                error={err("address")}
                hint={t(desk ? "checkout.communeHint" : "checkout.addressHint")}
              >
                <textarea
                  id="address"
                  rows={desk ? 1 : 3}
                  autoComplete={desk ? "address-level2" : "street-address"}
                  {...register("address")}
                  {...aria("address", true)}
                  className={inputClass(!!errors.address)}
                />
              </Field>
            </>
          )}
        </fieldset>

        <section>
          <h2 className="text-xl font-semibold">{t("checkout.payment")}</h2>
          {delivery ? (
            <p className="mt-2 text-text-muted">{t("checkout.cod")}</p>
          ) : (
            <div className="mt-2 rounded-lg bg-surface-alt p-4 text-sm">
              <p className="text-base">{t("checkout.instore")}</p>
              <p className="mt-3 font-semibold">{t("checkout.pickupAt", { name: identity.name })}</p>
              <address className="not-italic text-text-muted">
                {contact.address.street}, {contact.address.city}
              </address>
              <ul className="mt-2 text-text-muted">
                {contact.hours.map((h) => (
                  <li key={h.days.join()}>
                    {dayRange(h.days)} · {h.opens}–{h.closes}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit rounded-lg bg-surface-alt p-5 lg:sticky lg:top-16">
        <h2 className="text-xl font-semibold">{t("checkout.summary")}</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {lines.map((l) => (
            <li key={l.sku} className="flex justify-between gap-3 py-2">
              <span>
                {l.qty} × {l.name}
                <span className="block text-text-muted">{l.variantLabel}</span>
              </span>
              <span className="tabular-nums">{formatPrice(l.qty * l.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt>{t("cart.subtotal")}</dt>
            <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("checkout.deliveryFee")}</dt>
            <dd className="tabular-nums">{!feeKnown ? t("checkout.feeByWilaya") : fee ? formatPrice(fee) : t("checkout.free")}</dd>
          </div>
          <div className="mt-2 flex justify-between text-lg font-semibold">
            <dt>{t("checkout.total")}</dt>
            <dd className="tabular-nums">{formatPrice(subtotal + fee)}</dd>
          </div>
        </dl>
        {errors.root && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting || placed}
          className={buttonClass({ size: "lg", className: "mt-5 w-full" })}
        >
          {isSubmitting || placed ? t("checkout.submitting") : t("checkout.submit")}
        </button>
      </aside>
    </form>
  );
}
