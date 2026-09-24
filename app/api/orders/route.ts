import { revalidatePath } from "next/cache";
import wilayas from "@/content/wilayas.json";
import { storeConfig } from "@/lib/config/store.config";
import { repo } from "@/lib/data/repository";
import { variantLabel } from "@/lib/i18n";
import { orderInputSchema, OutOfStockError, priceOrder } from "@/lib/order";

// ponytail: in-memory, per-instance sliding window. Swap for Upstash/Redis when running >1 instance.
const WINDOW_MS = 10 * 60_000;
const MAX_ORDERS = 10; // DZ mobile carriers use CGNAT: many customers can share one IP
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear(); // crude memory cap
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_ORDERS;
}

const fail = (error: string, status: number, extra?: object) => Response.json({ error, ...extra }, { status });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (limited(ip)) return fail("rate_limited", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const parsed = orderInputSchema.safeParse(body); // strips unknown keys: client prices never get in
  if (!parsed.success) return fail("invalid", 400, { issues: parsed.error.issues.map((i) => i.path.join(".")) });
  const input = parsed.data;

  const { commerce } = storeConfig;
  const delivery = input.fulfillment === "delivery";
  if (delivery ? !commerce.deliveryEnabled : !commerce.pickupEnabled) return fail("fulfillment_disabled", 400);
  const wilaya = delivery ? wilayas.find((w) => w.code === input.wilaya) : undefined;
  if (delivery && !wilaya) return fail("invalid", 400, { issues: ["wilaya"] });

  const catalog = await repo.getVariants(input.items.map((i) => i.sku));
  const priced = priceOrder(input.items, catalog, delivery ? commerce.deliveryFeeFlat : 0, (p, v) =>
    `${p.name} · ${variantLabel(v.color.name, v.storage)}`,
  );
  if (!priced.ok) return fail(priced.error, 409, { sku: priced.sku });

  let order;
  try {
    order = await repo.createOrder({
      items: priced.items,
      totals: priced.totals,
      fulfillment: input.fulfillment,
      paymentMethod: delivery ? "cod" : "instore",
      customer: {
        name: input.name,
        phone: input.phone,
        ...(wilaya && { wilaya: `${wilaya.code} - ${wilaya.name}`, address: input.address }),
      },
    });
  } catch (e) {
    if (e instanceof OutOfStockError) return fail("out_of_stock", 409, { sku: e.sku }); // lost the race for the last unit
    throw e;
  }
  // Stock moved (db adapter): prebuilt pages showing it re-render on their next visit.
  for (const slug of new Set(catalog.map((c) => c.product.slug))) revalidatePath(`/product/${slug}`);
  revalidatePath("/");
  return Response.json({ order }, { status: 201 });
}
