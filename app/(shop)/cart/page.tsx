import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("cart.title"), robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 md:py-7">
      <h1 className="text-3xl font-semibold md:text-5xl">{t("cart.title")}</h1>
      <CartView />
    </div>
  );
}
