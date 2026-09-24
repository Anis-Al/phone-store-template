"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorKey, type ActionState } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { categoryOf } from "@/lib/config/store.config";
import { productInputSchema } from "@/lib/data/schemas";
import type { TKey } from "@/lib/i18n";
import { putImage } from "@/lib/media";

/** Storefront pages are prebuilt: mark them all stale so they re-render on their next visit. */
const refreshStore = () => revalidatePath("/", "layout");

const num = z.coerce.number().int().nonnegative().max(1e9);
const rowInput = z.object({
  sku: z.string().max(40),
  stock: num,
  stockWas: num,
  price: z.union([z.literal(""), num]).optional(),
  base: num.optional(),
});

/** Inline row on the product list. Staff: stock only. Stock is a delta from what the row showed. */
export async function saveVariant(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  try {
    const r = rowInput.parse(Object.fromEntries(form));
    const price = user.role === "owner" && r.price !== undefined ? (r.price === "" || r.price === r.base ? null : r.price) : undefined;
    await admin.updateVariants([{ sku: r.sku, price, stock: { delta: r.stock - r.stockWas } }], "edit", user.id);
  } catch (e) {
    return { error: errorKey(e) };
  }
  refreshStore();
  return { ok: true };
}

export async function setArchived(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole("owner");
  try {
    const { id, archived } = z.object({ id: z.string().max(64), archived: z.enum(["0", "1"]) }).parse(Object.fromEntries(form));
    await admin.setArchived(id, archived === "1", user.id);
  } catch (e) {
    return { error: errorKey(e) };
  }
  refreshStore();
  return { ok: true };
}

const productInput = productInputSchema.superRefine((p, ctx) => {
  const category = categoryOf(p.category);
  if (!category) ctx.addIssue({ code: "custom", path: ["category"], message: "admin.errors.required" });
  else if (category.specs && !p.specs) ctx.addIssue({ code: "custom", path: ["specs"], message: "admin.errors.required" });
});

export type SaveResult = { id?: string; error?: TKey; issues?: { path: string; message: string }[] };

/** Product editor. The payload is re-validated here: the client's validation is only for comfort. */
export async function saveProduct(payload: unknown): Promise<SaveResult> {
  const { user, admin } = await requireRole("owner");
  const parsed = productInput.safeParse(payload);
  if (!parsed.success) {
    return { error: "admin.products.editor.fix", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  try {
    const saved = await admin.saveProduct(parsed.data, user.id);
    refreshStore();
    return { id: saved.id };
  } catch (e) {
    return { error: errorKey(e) };
  }
}

export async function uploadImage(form: FormData): Promise<{ url?: string; error?: TKey }> {
  await requireRole("owner");
  const file = form.get("file");
  try {
    if (!(file instanceof File)) throw new Error("upload");
    return { url: await putImage(file) };
  } catch (e) {
    return { error: errorKey(e) };
  }
}
