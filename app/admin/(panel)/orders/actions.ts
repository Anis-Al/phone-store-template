"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorKey, type ActionState } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { CALL_OUTCOMES, ORDER_STATUSES } from "@/lib/data/schemas";
import { variantLabel, type TKey } from "@/lib/i18n";
import { checkoutFormSchema, repriceEdit } from "@/lib/order";
import { resolveDelivery } from "@/lib/wilayas";

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

const editMeta = z.object({
  id: z.string().max(40),
  was: z.string().max(40), // updatedAt the form was loaded with
  addSku: z.string().trim().max(64).optional(),
  addQty: z.coerce.number().int().min(1).max(99).catch(1),
});
const lineQty = z.coerce.number().int().min(0).max(99);

/** /admin/orders/[id]/edit: `qty:<sku>` per line (0 = remove), one optional added SKU, customer + delivery fields. */
export async function saveOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  let id;
  try {
    const f = Object.fromEntries(form);
    const meta = editMeta.parse(f);
    id = meta.id;
    const c = checkoutFormSchema.parse(f); // same rules as checkout (DZ phone, address or commune)
    const order = await admin.getOrder(meta.id);
    if (!order) throw new Error("not_found");

    const wanted = new Map<string, number>();
    for (const [k, v] of form) if (k.startsWith("qty:")) wanted.set(k.slice(4), lineQty.parse(v));
    if (meta.addSku) wanted.set(meta.addSku, (wanted.get(meta.addSku) ?? 0) + meta.addQty);
    const items = [...wanted].map(([sku, qty]) => ({ sku, qty }));
    const added = items.filter((i) => !order.items.some((o) => o.sku === i.sku)).map((i) => i.sku);
    const priced = repriceEdit(order.items, items, await admin.getVariants(added), (p, v) => `${p.name} · ${variantLabel(v.color.name, v.storage)}`);
    if (!priced.ok) throw new Error(priced.error);

    const d = resolveDelivery(c.fulfillment, c.wilaya, c.address);
    if (d.error) return { error: d.error === "wilaya" ? "errors.wilaya" : "admin.errors.fulfillment_disabled" };
    // The fee follows the destination only: same place, the customer keeps the fee they were quoted.
    const moved = d.fulfillment !== order.fulfillment || d.where.wilaya !== order.customer.wilaya || !d.where.desk !== !order.customer.desk;
    const fee = moved ? d.fee : order.totals.deliveryFee;
    const subtotal = priced.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    await admin.updateOrder(
      meta.id,
      {
        items: priced.items,
        totals: { subtotal, deliveryFee: fee, total: subtotal + fee },
        fulfillment: d.fulfillment,
        paymentMethod: d.paymentMethod,
        customer: { name: c.name, phone: c.phone, ...d.where },
      },
      meta.was,
      user.id,
    );
  } catch (e) {
    const msg = e instanceof z.ZodError ? (e.issues[0]?.message ?? "") : "";
    return { error: msg.startsWith("errors.") ? (msg as TKey) : errorKey(e) };
  }
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  // Stock moved: storefront pages showing it re-render on their next visit.
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/");
  redirect(`/admin/orders/${id}`);
}

const callInput = z.object({ id: z.string().max(40), outcome: z.enum(CALL_OUTCOMES) });

export async function logCall(_: ActionState, form: FormData): Promise<ActionState> {
  const { user, admin } = await requireRole();
  try {
    const { id, outcome } = callInput.parse(Object.fromEntries(form));
    await admin.logCall(id, outcome, user.id);
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
  } catch (e) {
    return { error: errorKey(e) };
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
