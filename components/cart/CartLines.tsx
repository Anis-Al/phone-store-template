"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MAX_QTY, useCart } from "@/lib/cart";
import { formatPrice, t } from "@/lib/i18n";

export function CartLines({ onNavigate }: { onNavigate?: () => void }) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  return (
    <ul className="divide-y divide-border">
      {lines.map((l) => {
        const max = Math.min(l.maxQty, MAX_QTY);
        return (
          <li key={l.sku} className="flex gap-4 py-4">
            <Link href={`/product/${l.slug}`} onClick={onNavigate} className="shrink-0 rounded-sm bg-surface-alt">
              <Image src={l.image} alt="" width={80} height={80} className="size-20 object-contain" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/product/${l.slug}`} onClick={onNavigate} className="inline-flex min-h-11 items-center font-semibold">
                {l.name}
              </Link>
              <p className="text-sm text-text-muted">{l.variantLabel}</p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-pill border border-border" role="group" aria-label={t("cart.qty")}>
                  <button
                    type="button"
                    onClick={() => setQty(l.sku, l.qty - 1)}
                    disabled={l.qty <= 1}
                    aria-label={t("cart.decrease")}
                    className="inline-flex size-11 items-center justify-center disabled:opacity-40"
                  >
                    <Minus aria-hidden size={16} />
                  </button>
                  <output aria-live="polite" className="min-w-6 text-center tabular-nums">
                    {l.qty}
                  </output>
                  <button
                    type="button"
                    onClick={() => setQty(l.sku, l.qty + 1)}
                    disabled={l.qty >= max}
                    aria-label={t("cart.increase")}
                    className="inline-flex size-11 items-center justify-center disabled:opacity-40"
                  >
                    <Plus aria-hidden size={16} />
                  </button>
                </div>
                <p className="font-semibold tabular-nums">{formatPrice(l.unitPrice * l.qty)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(l.sku)}
              aria-label={t("cart.remove", { name: l.name })}
              className="inline-flex size-11 shrink-0 items-center justify-center text-text-muted"
            >
              <Trash2 aria-hidden size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
