import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import productsJson from "@/content/products.json";
import { filterProducts, withCategory } from "@/lib/catalog";
import { categorySlugs, storeConfig } from "@/lib/config/store.config";
import type { Repository } from "../repository";
import { orderSchema, productsFileSchema, type Order, type Product } from "../schemas";

// Validated on first use: a malformed products.json fails the build, not a customer.
let cache: Product[] | undefined;
const products = () => (cache ??= productsFileSchema.parse(productsJson).map((p) => withCategory(p, categorySlugs)));

// ponytail: JSON file store for demos: single process, stock never moves, no admin panel.
// Live stores run DATA_ADAPTER=db (lib/data/adapters/db.ts).
const ORDERS_FILE = process.env.ORDERS_FILE ?? path.join(process.cwd(), ".data", "orders.json");

async function readOrders(): Promise<Order[]> {
  try {
    return orderSchema.array().parse(JSON.parse(await readFile(/*turbopackIgnore: true*/ ORDERS_FILE, "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

let queue: Promise<unknown> = Promise.resolve(); // serialises writes → no duplicate refs

export const localAdapter: Repository = {
  getProducts: async (filters = {}) => filterProducts(products(), filters),
  getProductBySlug: async (slug) => products().find((p) => p.slug === slug) ?? null,
  getBrands: async () => [...new Set(products().map((p) => p.brand))].sort(),
  getVariants: async (skus) =>
    products().flatMap((product) =>
      product.variants.filter((v) => skus.includes(v.sku)).map((variant) => ({ product, variant })),
    ),

  createOrder: (draft) => {
    const run = queue.then(async () => {
      const orders = await readOrders();
      const last = Math.max(1000, ...orders.map((o) => Number(o.id.split("-")[1]) || 0));
      const order: Order = {
        ...draft,
        id: `${storeConfig.commerce.orderPrefix}-${last + 1}`,
        status: "new",
        createdAt: new Date().toISOString(),
      };
      await mkdir(/*turbopackIgnore: true*/ path.dirname(ORDERS_FILE), { recursive: true });
      const tmp = `${ORDERS_FILE}.tmp`;
      await writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify([...orders, order], null, 2));
      await rename(/*turbopackIgnore: true*/ tmp, ORDERS_FILE); // atomic swap: a crash never leaves half a file
      return order;
    });
    queue = run.catch(() => {});
    return run;
  },
};
