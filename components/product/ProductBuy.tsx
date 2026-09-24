"use client";

import { MessageCircle, Store, Truck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { variantPrice } from "@/lib/catalog";
import { storeConfig } from "@/lib/config/store.config";
import type { Product, Variant } from "@/lib/data/schemas";
import { formatPrice, t, variantLabel } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";
import { Gallery } from "./Gallery";
import { StockBadge } from "./StockBadge";
import { VariantPicker } from "./VariantPicker";

const defaultVariant = (p: Product) =>
  [...p.variants].filter((v) => v.stockQty > 0).sort((a, b) => variantPrice(p, a) - variantPrice(p, b))[0] ??
  p.variants[0];

export function ProductBuy({ product }: { product: Product }) {
  const [variant, setVariant] = useState<Variant>(() => defaultVariant(product));
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);
  const setSheet = useCart((s) => s.setSheet);

  const images = variant.images ?? product.images;
  const price = variantPrice(product, variant);
  const soldOut = variant.stockQty === 0;
  const { commerce } = storeConfig;

  const addToCart = () => {
    add({
      sku: variant.sku,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(variant.color.name, variant.storage),
      image: images[0],
      unitPrice: price,
      maxQty: variant.stockQty,
    });
    if (window.matchMedia("(min-width: 768px)").matches) return setSheet(true);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const cta = (
    <Button onClick={addToCart} disabled={soldOut} aria-live="polite" className="w-full">
      {soldOut ? t("product.outOfStock") : added ? t("product.added") : t("product.addToCart")}
    </Button>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-7">
      <Gallery key={images.join()} images={images} name={`${product.name} ${variant.color.name}`} />

      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-text-muted">{product.brand}</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-5xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={product.condition === "used" ? "inverse" : "neutral"}>
              {t(product.condition === "used" ? "product.used" : "product.new")}
            </Badge>
            <StockBadge qty={variant.stockQty} />
          </div>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{formatPrice(price)}</p>
        </div>

        <VariantPicker product={product} value={variant} onChange={setVariant} />

        <div className="max-md:hidden">{cta}</div>

        <ul className="flex flex-col gap-2 text-sm text-text-muted">
          {commerce.deliveryEnabled && (
            <li className="flex items-center gap-2">
              <Truck aria-hidden size={18} /> {t("product.deliveryInfo", { fee: formatPrice(commerce.deliveryFeeFlat) })}
            </li>
          )}
          {commerce.pickupEnabled && (
            <li className="flex items-center gap-2">
              <Store aria-hidden size={18} /> {t("product.pickupInfo")}
            </li>
          )}
        </ul>
        <a
          href={whatsappLink(t("product.whatsappText", { name: `${product.name} ${variantLabel(variant.color.name, variant.storage)}` }))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
        >
          <MessageCircle aria-hidden size={18} /> {t("product.askWhatsapp")}
        </a>
      </div>

      {/* Mobile sticky buy bar (Apple floating-sticky-bar). Fixed height → no layout shift. */}
      <div
        data-sticky-cta
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center gap-4 border-t border-border bg-surface-alt/90 px-4 backdrop-blur-md md:hidden"
      >
        <div className="min-w-0">
          <p className="truncate text-xs text-text-muted">
            {variantLabel(variant.color.name, variant.storage)}
          </p>
          <p className="font-semibold tabular-nums">{formatPrice(price)}</p>
        </div>
        <div className="ms-auto w-1/2">{cta}</div>
      </div>
    </div>
  );
}
