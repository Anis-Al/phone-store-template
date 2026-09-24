import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { fromPrice, totalStock, variantPrice } from "@/lib/catalog";
import type { Product } from "@/lib/data/schemas";
import { formatPrice, formatStorage, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StockBadge } from "./StockBadge";

export function specLine(p: Product) {
  if (!p.specs) return p.tagline ?? "";
  const storages = [...new Set(p.variants.flatMap((v) => v.storage ?? []))].sort((a, b) => a - b);
  return [p.specs.screen.split(" ")[0], t("product.ramLine", { size: formatStorage(p.specs.ram) }), storages.map(formatStorage).join(" / ")]
    .filter(Boolean)
    .join(" · ");
}

export function ProductCard({ product: p, priority }: { product: Product; priority?: boolean }) {
  const price = fromPrice(p);
  const varies = new Set(p.variants.map((v) => variantPrice(p, v))).size > 1;
  return (
    <article className="relative flex h-full flex-col rounded-lg border border-border bg-surface p-3 shadow-card md:p-4">
      <div className="relative aspect-square overflow-hidden rounded-sm bg-surface-alt">
        <Image
          src={p.images[0]}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
          className="object-contain p-3"
        />
        {p.condition === "used" && (
          <Badge tone="inverse" className="absolute start-2 top-2">
            {t("product.used")}
          </Badge>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="text-xs text-text-muted">{p.brand}</p>
        <h3 className="text-base leading-tight font-semibold">
          <Link href={`/product/${p.slug}`} className="after:absolute after:inset-0 after:rounded-lg">
            {p.name}
          </Link>
        </h3>
        <p className={cn("text-xs text-text-muted", !p.specs && "line-clamp-2")}>{specLine(p)}</p>
        <p className="mt-auto pt-2 tabular-nums">
          {varies && <span className="text-xs text-text-muted">{t("product.from")} </span>}
          <span className="font-semibold">{formatPrice(price)}</span>
        </p>
        <StockBadge qty={totalStock(p)} />
      </div>
    </article>
  );
}
