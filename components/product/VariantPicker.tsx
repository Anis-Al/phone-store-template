"use client";

import { variantPrice } from "@/lib/catalog";
import type { Product, Variant } from "@/lib/data/schemas";
import { formatPrice, formatStorage, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const optionClass =
  "relative has-disabled:cursor-not-allowed has-disabled:opacity-40 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus";

/** Color × storage. Combos that don't exist or are out of stock are disabled, never selectable. */
export function VariantPicker({
  product,
  value,
  onChange,
}: {
  product: Product;
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  const vs = product.variants;
  const colors = [...new Map(vs.map((v) => [v.color.name, v.color])).values()];
  const storages = [...new Set(vs.flatMap((v) => v.storage ?? []))].sort((a, b) => a - b);
  const find = (color: string, storage: number | undefined) =>
    vs.find((v) => v.color.name === color && v.storage === storage && v.stockQty > 0);

  const pickColor = (color: string) => {
    const next = find(color, value.storage) ?? vs.find((v) => v.color.name === color && v.stockQty > 0);
    if (next) onChange(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="text-sm">
          <span className="font-semibold">{t("product.color")}</span> · {value.color.name}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {colors.map((c) => {
            const available = vs.some((v) => v.color.name === c.name && v.stockQty > 0);
            return (
              <label key={c.name} className={cn(optionClass, "rounded-pill")} title={c.name}>
                <input
                  type="radio"
                  name={`${product.id}-color`}
                  className="sr-only"
                  checked={value.color.name === c.name}
                  disabled={!available}
                  onChange={() => pickColor(c.name)}
                  aria-label={available ? c.name : `${c.name} — ${t("product.unavailable")}`}
                />
                <span
                  className={cn(
                    "flex size-11 rounded-pill border-2 p-1",
                    value.color.name === c.name ? "border-primary" : "border-transparent",
                  )}
                >
                  <span className="size-full rounded-pill border border-border" style={{ backgroundColor: c.hex }} />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {storages.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold">{t("product.storage")}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {storages.map((s) => {
              const v = find(value.color.name, s);
              const selected = value.storage === s;
              return (
                <label
                  key={s}
                  className={cn(
                    optionClass,
                    "flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-md border-2 px-3 py-2 text-center",
                    selected ? "border-primary" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name={`${product.id}-storage`}
                    className="sr-only"
                    checked={selected}
                    disabled={!v}
                    onChange={() => v && onChange(v)}
                  />
                  <span className="font-semibold">{formatStorage(s)}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {v ? formatPrice(variantPrice(product, v)) : t("product.unavailable")}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
