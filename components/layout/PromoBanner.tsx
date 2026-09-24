import Link from "next/link";
import { storeConfig } from "@/lib/config/store.config";

export function PromoBanner() {
  const { features, promo } = storeConfig;
  if (!features.showPromoBanner || !promo.text) return null;
  return (
    <Link href={promo.href} className="block bg-surface-alt px-4 py-3 text-center text-sm">
      {promo.text} <span className="text-primary" aria-hidden>›</span>
    </Link>
  );
}
