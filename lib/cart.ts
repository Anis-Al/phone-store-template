import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_QTY = 10;

/** Display snapshot only — the server re-prices every order from catalog data. */
export interface CartLine {
  sku: string;
  slug: string;
  name: string;
  variantLabel: string;
  image: string;
  unitPrice: number;
  maxQty: number;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  sheetOpen: boolean;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  setSheet: (open: boolean) => void;
}

const clamp = (n: number, max: number) => Math.max(1, Math.min(n, max, MAX_QTY));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      sheetOpen: false,
      add: (line, qty = 1) =>
        set((s) => {
          const hit = s.lines.find((l) => l.sku === line.sku);
          return {
            lines: hit
              ? s.lines.map((l) => (l.sku === line.sku ? { ...line, qty: clamp(l.qty + qty, line.maxQty) } : l))
              : [...s.lines, { ...line, qty: clamp(qty, line.maxQty) }],
          };
        }),
      setQty: (sku, qty) =>
        set((s) => ({ lines: s.lines.map((l) => (l.sku === sku ? { ...l, qty: clamp(qty, l.maxQty) } : l)) })),
      remove: (sku) => set((s) => ({ lines: s.lines.filter((l) => l.sku !== sku) })),
      clear: () => set({ lines: [] }),
      setSheet: (sheetOpen) => set({ sheetOpen }),
    }),
    { name: "cart", version: 1, partialize: (s) => ({ lines: s.lines }) },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);

const noop = () => () => {};
/** false during SSR + hydration, true after — gate localStorage-backed UI to avoid mismatches. */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
