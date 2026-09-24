"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cartSubtotal, useCart, useHydrated } from "@/lib/cart";
import { formatPrice, t } from "@/lib/i18n";
import { CartLines } from "./CartLines";

/** Desktop cart drawer (mobile uses the /cart page). Mounted once in the root layout. */
export function CartSheet() {
  const open = useCart((s) => s.sheetOpen);
  const setSheet = useCart((s) => s.setSheet);
  const stored = useCart((s) => s.lines);
  const lines = useHydrated() ? stored : []; // localStorage is client-only
  const close = () => setSheet(false);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("cart.title")}
      footer={
        lines.length > 0 && (
          <>
            <p className="flex justify-between text-lg font-semibold">
              <span>{t("cart.subtotal")}</span>
              <span className="tabular-nums">{formatPrice(cartSubtotal(lines))}</span>
            </p>
            <p className="mt-1 text-sm text-text-muted">{t("cart.shippingNote")}</p>
            <Link href="/checkout" onClick={close} className={buttonClass({ className: "mt-4 w-full" })}>
              {t("cart.checkout")}
            </Link>
          </>
        )
      }
    >
      {lines.length ? (
        <CartLines onNavigate={close} />
      ) : (
        <div className="py-7 text-center">
          <p className="text-text-muted">{t("cart.empty")}</p>
          <Link href="/catalog" onClick={close} className={buttonClass({ variant: "secondary", className: "mt-5" })}>
            {t("cart.continue")}
          </Link>
        </div>
      )}
    </Sheet>
  );
}
