import { orderQuerySchema } from "@/lib/admin";
import { requireRole } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

/** CSV of the filtered order list (same query params as /admin/orders), all pages. */
export async function GET(req: Request) {
  const { admin } = await requireRole();
  const q = orderQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows } = await admin.listOrders({ ...q, page: 1, pageSize: 10_000 });
  const csv = toCsv([
    ["ref", "date", "status", "fulfillment", "name", "phone", "wilaya", "address", "items", "subtotal", "delivery_fee", "total", "note"],
    ...rows.map((o) => [
      o.id, o.createdAt, o.status, o.customer.desk ? "desk" : o.fulfillment, o.customer.name, o.customer.phone, o.customer.wilaya, o.customer.address,
      o.items.map((i) => `${i.qty} x ${i.label} [${i.sku}]`).join(" | "),
      o.totals.subtotal, o.totals.deliveryFee, o.totals.total, o.note,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
