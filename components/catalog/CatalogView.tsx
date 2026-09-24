"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { filtersToQuery, SORTS, type ProductFilters, type Sort } from "@/lib/catalog";
import { multiCategory, storeConfig } from "@/lib/config/store.config";
import { formatStorage, t, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Facets = { brands: string[]; storage: number[]; ram: number[]; conditions: ("new" | "used")[] };

const SORT_LABEL: Record<Sort, TKey> = {
  featured: "catalog.sortFeatured",
  "price-asc": "catalog.sortPriceAsc",
  "price-desc": "catalog.sortPriceDesc",
  newest: "catalog.sortNewest",
};

const chip =
  "inline-flex min-h-11 cursor-pointer items-center rounded-pill border border-border px-4 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-fg has-focus-visible:outline-2 has-focus-visible:outline-focus";

/**
 * Filters live in the URL (shareable, survive reload). Changing one = router.replace → the server
 * page re-renders with new searchParams; the transition keeps the old grid visible meanwhile.
 */
export function CatalogView({
  facets,
  filters,
  count,
  children,
}: {
  facets: Facets;
  filters: ProductFilters;
  count: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState(false);

  const update = (patch: Partial<ProductFilters>) =>
    startTransition(() => router.replace(pathname + filtersToQuery({ ...filters, ...patch }), { scroll: false }));

  const toggle = <K extends "brand" | "storage" | "ram" | "condition">(key: K, value: NonNullable<ProductFilters[K]>[number]) => {
    const cur = (filters[key] ?? []) as (typeof value)[];
    update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  const active =
    (filters.brand?.length ?? 0) +
    (filters.storage?.length ?? 0) +
    (filters.ram?.length ?? 0) +
    (filters.condition?.length ?? 0) +
    Number(filters.minPrice != null) +
    Number(filters.maxPrice != null);

  const reset = () => update({ brand: [], storage: [], ram: [], condition: [], minPrice: undefined, maxPrice: undefined });
  const pickCategory = (category?: string) => update({ category, brand: [], storage: [], ram: [], condition: [] });

  const panel = (id: string) => (
    <div className="flex flex-col gap-6">
      <Group legend={t("catalog.brand")}>
        {facets.brands.map((b) => (
          <label key={b} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={filters.brand?.includes(b) ?? false}
              onChange={() => toggle("brand", b)}
            />
            {b}
          </label>
        ))}
      </Group>
      {facets.storage.length > 0 && (
        <Group legend={t("catalog.storage")} row>
          {facets.storage.map((s) => (
            <label key={s} className={chip}>
              <input
                type="checkbox"
                className="sr-only"
                checked={filters.storage?.includes(s) ?? false}
                onChange={() => toggle("storage", s)}
              />
              {formatStorage(s)}
            </label>
          ))}
        </Group>
      )}
      {facets.ram.length > 0 && (
        <Group legend={t("catalog.ram")} row>
          {facets.ram.map((r) => (
            <label key={r} className={chip}>
              <input type="checkbox" className="sr-only" checked={filters.ram?.includes(r) ?? false} onChange={() => toggle("ram", r)} />
              {formatStorage(r)}
            </label>
          ))}
        </Group>
      )}
      {facets.conditions.length > 1 && (
        <Group legend={t("catalog.condition")} row>
          {facets.conditions.map((c) => (
            <label key={c} className={chip}>
              <input
                type="checkbox"
                className="sr-only"
                checked={filters.condition?.includes(c) ?? false}
                onChange={() => toggle("condition", c)}
              />
              {t(c === "new" ? "product.new" : "product.used")}
            </label>
          ))}
        </Group>
      )}
      <Group legend={t("catalog.price", { currency: storeConfig.commerce.currency })} row>
        {(["minPrice", "maxPrice"] as const).map((k) => (
          <div key={k} className="flex-1">
            <label htmlFor={`${id}-${k}`} className="text-xs text-text-muted">
              {t(k === "minPrice" ? "catalog.min" : "catalog.max")}
            </label>
            <input
              id={`${id}-${k}`}
              key={filters[k] ?? ""} // re-mount on reset/back so the field shows the URL value
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              defaultValue={filters[k]}
              onBlur={(e) => {
                const n = e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value)));
                if (n !== filters[k]) update({ [k]: n });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={inputClass()}
            />
          </div>
        ))}
      </Group>
    </div>
  );

  return (
    <div className="lg:flex lg:gap-7">
      <aside className="hidden w-64 shrink-0 lg:block" aria-label={t("catalog.filters")}>
        {panel("side")}
        {active > 0 && (
          <Button variant="ghost" onClick={reset} className="mt-4">
            {t("catalog.reset")}
          </Button>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {multiCategory && (
          <fieldset className="mb-4">
            <legend className="sr-only">{t("catalog.category")}</legend>
            <div className="flex flex-wrap gap-2">
              {[{ slug: undefined, label: t("catalog.all") }, ...storeConfig.categories].map((c) => (
                <label key={c.slug ?? ""} className={chip}>
                  <input
                    type="radio"
                    name="category"
                    className="sr-only"
                    checked={filters.category === c.slug}
                    onChange={() => pickCategory(c.slug)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-normal text-text-muted" aria-live="polite">
            {t("catalog.results", { n: count })}
          </h2>
          <Button variant="secondary" onClick={() => setSheet(true)} className="lg:hidden">
            <SlidersHorizontal aria-hidden size={16} />
            {t("catalog.filters")}
            {active > 0 && ` (${active})`}
          </Button>
          <label className="ms-auto flex items-center gap-2 text-sm">
            <span className="text-text-muted max-sm:sr-only">{t("catalog.sort")}</span>
            <select
              value={filters.sort ?? "featured"}
              onChange={(e) => update({ sort: e.target.value as Sort })}
              className="min-h-11 rounded-pill border border-border bg-surface px-4"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(SORT_LABEL[s])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div aria-busy={pending} className={cn("transition-opacity", pending && "opacity-50")}>
          {children}
        </div>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t("catalog.filters")}
        side="start"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} disabled={!active} className="flex-1">
              {t("catalog.reset")}
            </Button>
            <Button onClick={() => setSheet(false)} className="flex-1">
              {t("catalog.apply")} ({count})
            </Button>
          </div>
        }
      >
        {panel("sheet")}
      </Sheet>
    </div>
  );
}

function Group({ legend, row, children }: { legend: string; row?: boolean; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className={row ? "flex flex-wrap gap-2" : "flex flex-col"}>{children}</div>
    </fieldset>
  );
}
