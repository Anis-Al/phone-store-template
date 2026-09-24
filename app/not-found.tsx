import Link from "next/link";
import { StoreShell } from "@/components/layout/StoreShell";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <StoreShell>
      <div className="mx-auto max-w-xl px-5 py-8 text-center">
        <p className="text-sm font-semibold text-text-muted">404</p>
        <h1 className="mt-2 text-4xl font-semibold">{t("errors.notFoundTitle")}</h1>
        <p className="mt-3 text-text-muted">{t("errors.notFoundText")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/catalog" className={buttonClass()}>
            {t("nav.catalog")}
          </Link>
          <Link href="/" className={buttonClass({ variant: "secondary" })}>
            {t("nav.home")}
          </Link>
        </div>
      </div>
    </StoreShell>
  );
}
