"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorKey, type ActionState } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUSES } from "@/lib/data/schemas";

const statusInput = z
  .object({ id: z.string().max(40), next: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() })
  .refine((v) => v.next !== "cancelled" || (v.note?.length ?? 0) >= 3, { message: "admin.orders.reasonRequired" });

export async function setStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  let input;
  try {
    input = statusInput.parse(Object.fromEntries(form));
    await admin.setOrderStatus(input.id, input.next, user.id, input.note || undefined);
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "";
    return { error: msg === "admin.orders.reasonRequired" ? msg : errorKey(e) };
  }
  revalidatePath(`/admin/orders/${input.id}`);
  revalidatePath("/admin/orders");
  if (input.next === "cancelled") {
    // Stock came back: storefront pages showing it re-render on their next visit.
    revalidatePath("/product/[slug]", "page");
    revalidatePath("/");
  }
  return { ok: true };
}

const noteInput = z.object({ id: z.string().max(40), note: z.string().trim().max(2000) });

export async function saveNote(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  try {
    const { id, note } = noteInput.parse(Object.fromEntries(form));
    await admin.setOrderNote(id, note, user.id);
    revalidatePath(`/admin/orders/${id}`);
  } catch (e) {
    return { error: errorKey(e) };
  }
  return { ok: true };
}
