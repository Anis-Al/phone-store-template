import { z } from "zod";
import type { Condition, Product, Variant } from "./data/schemas";

export const SORTS = ["featured", "price-asc", "price-desc", "newest"] as const;
export type Sort = (typeof SORTS)[number];

export interface ProductFilters {
  q?: string;
  category?: string;
  brand?: string[];
  storage?: number[];
  ram?: number[];
  condition?: Condition[];
  minPrice?: number;
  maxPrice?: number;
  sort?: Sort;
  featured?: boolean;
  limit?: number;
}

export const variantPrice = (p: Product, v: Variant) => v.priceOverride ?? p.basePrice;

/** Card price: cheapest in-stock variant, falling back to cheapest overall. */
export function fromPrice(p: Product): number {
  const inStock = p.variants.filter((v) => v.stockQty > 0);
  return Math.min(...(inStock.length ? inStock : p.variants).map((v) => variantPrice(p, v)));
}

export const withCategory = <T extends { category: string }>(p: T, slugs: readonly string[]): T =>
  slugs.includes(p.category) ? p : { ...p, category: slugs[0] };

export const cellKey = (cid: number, storage?: number) => `${cid}|${storage ?? ""}`;

export function moveAxis<C extends { on: boolean }>(
  cells: Record<string, C>, cids: number[], prev: number[], next: number[], blank: C,
): Record<string, C> {
  const out = { ...cells };
  const onto = !prev.length && next.length ? next[0] : undefined;
  for (const cid of cids) {
    if (onto !== undefined) out[cellKey(cid, onto)] = cells[cellKey(cid)] ?? { ...blank, on: true };
    else if (prev.length && !next.length) out[cellKey(cid)] = cells[cellKey(cid, prev[0])] ?? blank;
    for (const s of next) {
      if (s !== onto && !prev.includes(s)) out[cellKey(cid, s)] = { ...(cells[cellKey(cid, s)] ?? blank), on: true };
    }
  }
  return out;
}

export type StockLevel = "in" | "low" | "out";
export const stockLevel = (qty: number): StockLevel => (qty > 3 ? "in" : qty > 0 ? "low" : "out");
export const totalStock = (p: Product) => p.variants.reduce((n, v) => n + v.stockQty, 0);

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const isSubsequence = (needle: string, word: string) => {
  let i = 0;
  for (const ch of word) if (ch === needle[i]) i++;
  return i === needle.length;
};

/**
 * 0 = no match. Every query token must hit: substring (2 pts, +1 if a word starts with it)
 * or in-order subsequence of a word (1 pt) — so "iphne", "galxy s25" still match.
 * ponytail: no typo-substitution tolerance; swap for Fuse.js if customers complain.
 */
export function fuzzyScore(query: string, haystack: string): number {
  const words = norm(haystack).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const hay = words.join(" ");
  let score = 0;
  for (const token of norm(query).split(/\s+/).filter(Boolean)) {
    if (hay.includes(token)) score += words.some((w) => w.startsWith(token)) ? 3 : 2;
    else if (token.length > 2 && words.some((w) => isSubsequence(token, w))) score += 1;
    else return 0;
  }
  return score;
}

const searchText = (p: Product) =>
  [p.brand, p.name, p.model, ...p.tags, ...p.variants.map((v) => `${v.storage ?? ""} ${v.color.name}`)].join(" ");

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  const scores = new Map<string, number>();
  const q = f.q?.trim();
  const out = products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.brand?.length && !f.brand.includes(p.brand)) return false;
    if (f.condition?.length && !f.condition.includes(p.condition)) return false;
    if (f.ram?.length && !(p.specs && f.ram.includes(p.specs.ram))) return false;
    if (f.storage?.length && !p.variants.some((v) => v.storage && f.storage!.includes(v.storage))) return false;
    if (f.featured && !p.featured) return false;
    const price = fromPrice(p);
    if (f.minPrice != null && price < f.minPrice) return false;
    if (f.maxPrice != null && price > f.maxPrice) return false;
    if (q) {
      const s = fuzzyScore(q, searchText(p));
      if (!s) return false;
      scores.set(p.id, s);
    }
    return true;
  });

  const newest = (a: Product, b: Product) => b.createdAt.localeCompare(a.createdAt);
  const by: Record<Sort, (a: Product, b: Product) => number> = {
    featured: (a, b) =>
      (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || Number(b.featured) - Number(a.featured) || newest(a, b),
    "price-asc": (a, b) => fromPrice(a) - fromPrice(b),
    "price-desc": (a, b) => fromPrice(b) - fromPrice(a),
    newest,
  };
  const sort = by[f.sort ?? "featured"];
  // Sold-out products always sink to the end.
  out.sort((a, b) => Number(totalStock(a) === 0) - Number(totalStock(b) === 0) || sort(a, b));
  return f.limit ? out.slice(0, f.limit) : out;
}

/** Same category first, then same brand, then closest price. */
export function relatedProducts(products: Product[], p: Product, n = 4): Product[] {
  const price = fromPrice(p);
  return products
    .filter((o) => o.id !== p.id && totalStock(o) > 0)
    .sort(
      (a, b) =>
        Number(b.category === p.category) - Number(a.category === p.category) ||
        Number(b.brand === p.brand) - Number(a.brand === p.brand) ||
        Math.abs(fromPrice(a) - price) - Math.abs(fromPrice(b) - price),
    )
    .slice(0, n);
}

export function facets(products: Product[]) {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    brands: uniq(products.map((p) => p.brand)).sort(),
    storage: uniq(products.flatMap((p) => p.variants.flatMap((v) => v.storage ?? []))).sort((a, b) => a - b),
    ram: uniq(products.flatMap((p) => p.specs?.ram ?? [])).sort((a, b) => a - b),
    conditions: uniq(products.map((p) => p.condition)),
  };
}

// ---- URL <-> filters (URL is external input: validated, bad params dropped not thrown) ----

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const list = z.preprocess(first, z.string().transform((s) => s.split(",").filter(Boolean)));
const nums = list.transform((a) => a.map(Number).filter(Number.isFinite));
const num = z.preprocess(first, z.coerce.number().int().nonnegative());

const filtersSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(80)).optional().catch(undefined),
  category: z.preprocess(first, z.string().regex(/^[a-z0-9-]{1,40}$/)).optional().catch(undefined),
  brand: list.optional().catch(undefined),
  storage: nums.optional().catch(undefined),
  ram: nums.optional().catch(undefined),
  condition: list.pipe(z.array(z.enum(["new", "used"]))).optional().catch(undefined),
  minPrice: num.optional().catch(undefined),
  maxPrice: num.optional().catch(undefined),
  sort: z.preprocess(first, z.enum(SORTS)).optional().catch(undefined),
});

export type SearchParamsLike = Record<string, string | string[] | undefined>;

export const parseFilters = (sp: SearchParamsLike): ProductFilters => filtersSchema.parse(sp);

export function filtersToQuery(f: ProductFilters): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (k === "sort" && v === "featured") continue;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
