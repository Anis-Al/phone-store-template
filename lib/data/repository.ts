import type { ProductFilters } from "@/lib/catalog";
import { categorySlugs, storeConfig } from "@/lib/config/store.config";
import { openDb } from "@/lib/db/client";
import { createDbAdapter } from "./adapters/db";
import { localAdapter } from "./adapters/local";
import type { Order, OrderDraft, OrderStatus, Product, ProductInput, Variant } from "./schemas";

/**
 * The only door to data. Components/pages call `repo`, never an adapter or JSON file.
 * DATA_ADAPTER=local (default, demos): products.json + .data/orders.json.
 * DATA_ADAPTER=db (live stores): libSQL, required by the admin panel (`adminRepo`).
 * An Odoo JSON-RPC adapter would implement the same interface
 * (product.template → Product, product.product → Variant by SKU, stock per variant).
 */
export interface Repository {
  getProducts(filters?: ProductFilters): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getBrands(): Promise<string[]>;
  /** Resolve SKUs for order pricing. Unknown SKUs are simply absent from the result. */
  getVariants(skus: string[]): Promise<{ product: Product; variant: Variant }[]>;
  /** May throw OutOfStockError (lib/order.ts) when the adapter reserves stock. */
  createOrder(draft: OrderDraft): Promise<Order>;
}

export type UserId = number;
export type Role = "owner" | "staff";
export type AdminUser = { id: UserId; username: string; name: string; role: Role; sessionVersion: number; disabledAt: string | null };
export type AdminProduct = Product & { archivedAt: string | null; updatedAt: string };
export type StockReason = "order" | "cancel" | "manual" | "import" | "edit";
export type StockMovement = {
  id: number; sku: string; delta: number; reason: StockReason; note: string | null;
  orderId: string | null; userName: string | null; createdAt: string;
};
export type AuditEntry = { id: number; action: string; userName: string | null; diff: unknown; createdAt: string };
/** `stock.delta` keeps concurrent orders intact (inline edits); `stock.set` is absolute (CSV import). */
export type VariantChange = { sku: string; price?: number | null; stock?: { delta: number } | { set: number } };
export type VariantRow = { sku: string; productId: string; product: string; color: string; storage: number | null; price: number; stock: number };
export type OrderQuery = { status?: OrderStatus; search?: string; from?: string; to?: string; page: number; pageSize: number };

export interface AdminRepository extends Repository {
  listProducts(q: { search?: string; category?: string; brand?: string; condition?: Product["condition"]; archived?: boolean; lowStock?: boolean }): Promise<AdminProduct[]>;
  getProduct(id: string): Promise<AdminProduct | null>;
  /** One transaction: product + variants + `edit` stock movements + audit. */
  saveProduct(input: ProductInput, by: UserId): Promise<AdminProduct>;
  setArchived(id: string, archived: boolean, by: UserId): Promise<void>;
  /** One transaction for all rows (inline row save, CSV import). */
  updateVariants(changes: VariantChange[], reason: "manual" | "import" | "edit", by: UserId, note?: string): Promise<void>;
  listVariants(): Promise<VariantRow[]>;
  listOrders(q: OrderQuery): Promise<{ rows: Order[]; total: number; counts: Record<OrderStatus, number> }>;
  getOrder(id: string): Promise<Order | null>;
  /** State machine (lib/order.ts). Cancelling restores reserved stock exactly once. */
  setOrderStatus(id: string, next: OrderStatus, by: UserId, note?: string): Promise<void>;
  setOrderNote(id: string, note: string, by: UserId): Promise<void>;
  audit(entity: string, entityId: string): Promise<AuditEntry[]>;
  stockMovements(q: { sku?: string; reason?: StockReason; page: number; pageSize: number }): Promise<{ rows: StockMovement[]; total: number }>;
  dashboard(): Promise<{
    newOrders: number; readyOrders: number;
    lowStock: VariantRow[];
    last7: { orders: number; revenue: number }; last30: { orders: number; revenue: number };
    topSkus: { sku: string; label: string; qty: number; revenue: number }[];
  }>;
  findUser(username: string): Promise<(AdminUser & { passwordHash: string }) | null>;
  getUser(id: UserId): Promise<AdminUser | null>;
  listUsers(): Promise<AdminUser[]>;
  createUser(u: { username: string; name: string; role: Role; passwordHash: string }, by: UserId | null): Promise<UserId>;
  /** A new password or disabling bumps session_version: that user is logged out everywhere. */
  updateUser(id: UserId, change: { passwordHash?: string; role?: Role; disabled?: boolean }, by: UserId): Promise<void>;
}

const db = process.env.DATA_ADAPTER === "db" ? createDbAdapter(openDb(), storeConfig.commerce.orderPrefix, categorySlugs) : null;
const adapter: Repository = db ?? localAdapter;

/** The admin panel needs the database. null on the local adapter → /admin is a 404. */
export const adminRepo: AdminRepository | null = db;

// Store feature toggles applied once, for every adapter.
const showUsed = storeConfig.features.showUsedPhones;
const visible = (p: Product) => showUsed || p.condition === "new";

export const repo: Repository = {
  ...adapter,
  getProducts: (f = {}) => adapter.getProducts(showUsed ? f : { ...f, condition: ["new"] }),
  getProductBySlug: async (slug) => {
    const p = await adapter.getProductBySlug(slug);
    return p && visible(p) ? p : null;
  },
  getVariants: async (skus) => (await adapter.getVariants(skus)).filter((r) => visible(r.product)),
};
