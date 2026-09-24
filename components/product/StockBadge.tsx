import { Badge } from "@/components/ui/badge";
import { stockLevel } from "@/lib/catalog";
import { storeConfig } from "@/lib/config/store.config";
import { t } from "@/lib/i18n";

/** in-stock > 3 · low 1–3 · out 0. Exact counts only when features.showStockCount. */
export function StockBadge({ qty }: { qty: number }) {
  const level = stockLevel(qty);
  const count = storeConfig.features.showStockCount;
  const label =
    level === "out"
      ? t("product.outOfStock")
      : level === "low"
        ? count
          ? t("product.lowStockCount", { n: qty })
          : t("product.lowStock")
        : count
          ? t("product.stockCount", { n: qty })
          : t("product.inStock");
  const tone = level === "out" ? "danger" : level === "low" ? "warning" : "success";
  return (
    <Badge tone={tone}>
      <span aria-hidden className="size-2 rounded-pill bg-current" />
      {label}
    </Badge>
  );
}
