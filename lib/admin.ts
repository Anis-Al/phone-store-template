import { z } from "zod";
import fr from "@/content/locales/fr.json";
import { ORDER_STATUSES } from "@/lib/data/schemas";
import type { TKey } from "@/lib/i18n";

// Shared by admin Server Actions (server) and ActionForm (client). No server-only imports here.

export type ActionState = { ok?: boolean; error?: TKey } | null;

/** Error → i18n key. Adapters throw `new Error("sku_taken")`, schemas carry "admin.errors.x" messages. */
export function errorKey(e: unknown): TKey {
  const msg = e instanceof z.ZodError ? (e.issues[0]?.message ?? "") : e instanceof Error ? e.message : "";
  if (/^admin\.errors\.\w+$/.test(msg)) return msg as TKey;
  if (msg in fr.admin.errors) return `admin.errors.${msg}` as TKey;
  console.error(e);
  return "admin.errors.generic";
}

// ---- URL params (external input: bad values are dropped, never thrown) ----

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const opt = <T extends z.ZodType>(s: T) => z.preprocess(first, s.optional()).catch(undefined);

export const PAGE_SIZE = { products: 5, orders: 5, stock: 20 } as const;

export const orderQuerySchema = z.object({
  status: opt(z.enum(ORDER_STATUSES)),
  search: opt(z.string().trim().max(80)),
  from: opt(z.iso.date()),
  to: opt(z.iso.date()),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(100_000)).catch(1),
});

/** Current query + overrides → "?a=1&b=2" (empty values dropped). */
export function withQuery(current: Record<string, unknown>, patch: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const productQuerySchema = z.object({
  search: opt(z.string().trim().max(80)),
  category: opt(z.string().max(40)),
  brand: opt(z.string().max(60)),
  condition: opt(z.enum(["new", "used"])),
  archived: opt(z.literal("1")),
  lowStock: opt(z.literal("1")),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(100_000)).catch(1),
});

export const stockQuerySchema = z.object({
  sku: opt(z.string().trim().max(40)),
  reason: opt(z.enum(["order", "cancel", "manual", "import", "edit"])),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(100_000)).catch(1),
});
