"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { cartCount, useCart, useHydrated } from "@/lib/cart";
import { t } from "@/lib/i18n";

/** Mobile → /cart page. Desktop (md+) → cart sheet. */
export function CartButton() {
  const hydrated = useHydrated();
  const n = useCart((s) => cartCount(s.lines));
  const setSheet = useCart((s) => s.setSheet);
  const count = hydrated ? n : 0;

  return (
    <Link
      href="/cart"
      aria-label={t("nav.cartCount", { n: count })}
      onClick={(e) => {
        if (window.matchMedia("(min-width: 768px)").matches) {
          e.preventDefault();
          setSheet(true);
        }
      }}
      className="relative inline-flex size-11 items-center justify-center"
    >
      <ShoppingBag aria-hidden size={20} />
      {count > 0 && (
        <span className="absolute end-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-primary px-1 text-xs leading-none text-primary-fg">
          {count}
        </span>
      )}
    </Link>
  );
}
