import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("checkout.title"), robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-5 md:px-5 md:py-7">
      <h1 className="mb-6 text-3xl font-semibold md:text-5xl">{t("checkout.title")}</h1>
      <CheckoutForm />
    </div>
  );
}
