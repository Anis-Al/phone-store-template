import type { Metadata } from "next";
import { Suspense } from "react";
import { Confirmation } from "@/components/checkout/Confirmation";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("confirmation.title"), robots: { index: false } };

export default function ConfirmationPage() {
  return (
    <div className="px-4 py-8 md:py-8">
      <Suspense>
        <Confirmation />
      </Suspense>
    </div>
  );
}
