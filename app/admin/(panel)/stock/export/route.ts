import { requireRole } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

/** All live variants. Edit price/stock in a spreadsheet and re-import it on the Stock page. */
export async function GET() {
  const { admin } = await requireRole();
  const rows = await admin.listVariants();
  return new Response(toCsv([["sku", "product", "color", "storage", "price", "stock"], ...rows.map((v) => [v.sku, v.product, v.color, v.storage, v.price, v.stock])]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
