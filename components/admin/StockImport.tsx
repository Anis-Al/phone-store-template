"use client";

import { useActionState } from "react";
import type { ImportPreview } from "@/app/admin/(panel)/stock/actions";
import type { ActionState } from "@/lib/admin";
import { formatPrice, t } from "@/lib/i18n";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

/** CSV import: preview (dry run) → confirm. The confirm form re-sends the same CSV text. */
export function StockImport({
  preview,
  apply,
}: {
  preview: (prev: ImportPreview, form: FormData) => Promise<ImportPreview>;
  apply: (prev: ActionState, form: FormData) => Promise<ActionState>;
}) {
  const [state, previewAction] = useActionState(preview, null);
  const arrow = (pair: [number, number] | undefined, fmt: (n: number) => string) => (pair ? `${fmt(pair[0])} → ${fmt(pair[1])}` : "—");

  return (
    <div className="flex flex-col gap-3">
      <form action={previewAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("admin.stock.file")}
          <input type="file" name="file" accept=".csv,text/csv" required className="min-h-11 text-sm" />
        </label>
        <SubmitButton variant="secondary" pendingLabel="…">
          {t("admin.stock.preview")}
        </SubmitButton>
      </form>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      )}
      {state && "changed" in state && (
        <div className="flex flex-col gap-2 text-sm" role="status">
          <p className="font-semibold">{t("admin.stock.changed", { n: state.changed.length })}</p>
          <p className="text-text-muted">{t("admin.stock.unchanged", { n: state.unchanged })}</p>
          {state.unknown.length > 0 && <p className="text-warning">{t("admin.stock.unknown", { list: state.unknown.join(", ") })}</p>}
          {state.invalid.length > 0 && <p className="text-danger">{t("admin.stock.invalid", { list: state.invalid.join(", ") })}</p>}
          {state.changed.length > 0 && (
            <>
              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-alt">
                    <tr>
                      <th scope="col" className="px-2 py-1 text-start">{t("admin.stock.sku")}</th>
                      <th scope="col" className="px-2 py-1 text-end">{t("admin.products.price")}</th>
                      <th scope="col" className="px-2 py-1 text-end">{t("admin.products.stock")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.changed.map((c) => (
                      <tr key={c.sku}>
                        <td className="px-2 py-1">
                          {c.sku}
                          <span className="block text-xs text-text-muted">{c.product}</span>
                        </td>
                        <td className="px-2 py-1 text-end tabular-nums whitespace-nowrap">{arrow(c.price, formatPrice)}</td>
                        <td className="px-2 py-1 text-end tabular-nums whitespace-nowrap">{arrow(c.stock, String)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActionForm action={apply} okLabel={t("admin.stock.applied")}>
                <input type="hidden" name="csv" value={state.csv} />
                <SubmitButton>{t("admin.stock.confirm", { n: state.changed.length })}</SubmitButton>
              </ActionForm>
            </>
          )}
        </div>
      )}
    </div>
  );
}
