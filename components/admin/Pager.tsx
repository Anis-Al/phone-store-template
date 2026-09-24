import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { withQuery } from "@/lib/admin";
import { t } from "@/lib/i18n";

export function Pager({ path, q, pages }: { path: string; q: Record<string, unknown> & { page: number }; pages: number }) {
  if (pages <= 1) return null;
  const link = (page: number, label: string) => (
    <Link href={`${path}${withQuery(q, { page })}`} className={buttonClass({ variant: "secondary" })}>
      {label}
    </Link>
  );
  return (
    <nav aria-label={t("admin.common.page", { page: q.page, pages })} className="flex items-center justify-between gap-2">
      {q.page > 1 ? link(q.page - 1, t("admin.common.prev")) : <span />}
      <span className="text-sm text-text-muted">{t("admin.common.page", { page: q.page, pages })}</span>
      {q.page < pages ? link(q.page + 1, t("admin.common.next")) : <span />}
    </nav>
  );
}
