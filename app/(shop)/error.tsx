"use client";

import { Button, buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-8 text-center">
      <h1 className="text-3xl font-semibold">{t("errors.errorTitle")}</h1>
      <p className="mt-3 text-text-muted">{t("errors.generic")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("errors.retry")}</Button>
        <a href={whatsappLink()} className={buttonClass({ variant: "secondary" })}>
          WhatsApp
        </a>
      </div>
    </div>
  );
}
