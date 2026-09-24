"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorKey, type ActionState } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { parseStockCsv } from "@/lib/csv";
import type { VariantRow } from "@/lib/data/repository";
import { skuSchema } from "@/lib/data/schemas";
import { variantLabel, type TKey } from "@/lib/i18n";

const adjustInput = z.object({
  sku: skuSchema,
  delta: z.coerce.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "admin.errors.required"),
  note: z.string().trim().min(3, "admin.orders.reasonRequired").max(200),
});

/** Manual adjustment (breakage, theft, count error, delivery…): a delta with a required reason. */
export async function adjustStock(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  try {
    const { sku, delta, note } = adjustInput.parse(Object.fromEntries(form));
    if (!(await admin.listVariants()).some((v) => v.sku === sku)) return { error: "admin.errors.not_found" };
    await admin.updateVariants([{ sku, stock: { delta } }], "manual", user.id, note);
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "";
    return { error: msg === "admin.orders.reasonRequired" ? msg : errorKey(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

type Change = { sku: string; product: string; price?: [number, number]; stock?: [number, number] };
export type ImportPreview = { csv: string; changed: Change[]; unchanged: number; unknown: string[]; invalid: number[] } | { error: TKey } | null;

/** CSV rows vs current variants: what would change, what's unknown, what's invalid. */
function diff(csv: string, variants: VariantRow[]) {
  const { rows, invalid } = parseStockCsv(csv);
  const bySku = new Map(variants.map((v) => [v.sku, v]));
  const changed: Change[] = [];
  const unknown: string[] = [];
  let unchanged = 0;
  for (const r of rows) {
    const v = bySku.get(r.sku);
    if (!v) {
      unknown.push(r.sku);
      continue;
    }
    const c: Change = { sku: r.sku, product: `${v.product} · ${variantLabel(v.color, v.storage)}` };
    if (r.price !== undefined && r.price !== v.price) c.price = [v.price, r.price];
    if (r.stock !== undefined && r.stock !== v.stock) c.stock = [v.stock, r.stock];
    if (c.price || c.stock) changed.push(c);
    else unchanged++;
  }
  return { changed, unchanged, unknown, invalid: invalid.map((i) => i.line) };
}

const MAX_CSV = 1024 * 1024;
const readCsv = async (form: FormData) => {
  const file = form.get("file");
  const text = file instanceof File ? await file.text() : String(form.get("csv") ?? "");
  if (text.length > MAX_CSV) throw new Error("upload");
  return text;
};

/** Step 1 (dry run): nothing is written. */
export async function previewImport(_: ImportPreview, form: FormData): Promise<ImportPreview> {
  const { admin } = await requireRole("owner");
  try {
    const csv = await readCsv(form);
    return { csv, ...diff(csv, await admin.listVariants()) };
  } catch (e) {
    return { error: errorKey(e) };
  }
}

/** Step 2: the diff is recomputed against current data and applied in one transaction. */
export async function applyImport(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole("owner");
  try {
    const { changed } = diff(await readCsv(form), await admin.listVariants());
    if (!changed.length) return { error: "admin.stock.nothing" };
    await admin.updateVariants(
      changed.map((c) => ({ sku: c.sku, price: c.price?.[1], stock: c.stock && { set: c.stock[1] } })),
      "import",
      user.id,
    );
  } catch (e) {
    return { error: errorKey(e) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
