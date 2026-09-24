"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { cartSubtotal, useCart, useHydrated } from "@/lib/cart";
import { formatPrice, t } from "@/lib/i18n";
import { CartLines } from "./CartLines";

/** /cart page body (mobile cart; desktop uses the sheet but this page works everywhere). */
export function CartView() {
  const hydrated = useHydrated();
  const stored = useCart((s) => s.lines);
  const lines = hydrated ? stored : [];

  if (!hydrated) return <div className="min-h-64" aria-busy />;
  if (!lines.length)
    return (
      <div className="mt-6 rounded-lg bg-surface-alt px-5 py-8 text-center">
        <p className="text-text-muted">{t("cart.empty")}</p>
        <Link href="/catalog" className={buttonClass({ variant: "secondary", className: "mt-5" })}>
          {t("cart.continue")}
        </Link>
      </div>
    );

  return (
    <>
      <div className="mt-4">
        <CartLines />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <p className="flex justify-between text-lg font-semibold">
          <span>{t("cart.subtotal")}</span>
          <span className="tabular-nums">{formatPrice(cartSubtotal(lines))}</span>
        </p>
        <p className="mt-1 text-sm text-text-muted">{t("cart.shippingNote")}</p>
        <Link href="/checkout" className={buttonClass({ size: "lg", className: "mt-5 w-full" })}>
          {t("cart.checkout")}
        </Link>
      </div>
    </>
  );
}
