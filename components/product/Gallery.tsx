"use client";

import Image from "next/image";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Parent re-keys this on variant change, so the index resets without an effect. */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-alt">
        <Image
          src={images[i]}
          alt={t("product.image", { name, n: i + 1 })}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-contain p-5 drop-shadow-product"
        />
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-2">
          {images.map((src, n) => (
            <button
              key={src}
              type="button"
              onClick={() => setI(n)}
              aria-label={t("product.showImage", { n: n + 1 })}
              aria-current={n === i}
              className={cn(
                "relative size-16 overflow-hidden rounded-sm border-2 bg-surface-alt",
                n === i ? "border-primary" : "border-transparent",
              )}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
