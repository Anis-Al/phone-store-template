import raw from "@/content/wilayas.json";
import { storeConfig } from "@/lib/config/store.config";
import type { Order } from "@/lib/data/schemas";
import { formatPrice, t } from "@/lib/i18n";
import { deliveryFee, wilayaSchema } from "@/lib/order";

/** content/wilayas.json, validated once (a typo in a fee fails the build). */
export const wilayas = wilayaSchema.array().parse(raw);

const { commerce } = storeConfig;
export const deskEnabled = commerce.deliveryEnabled && commerce.deliveryFees.desk !== undefined;

/** "800 DA", or "dès 400 DA" when the fee depends on the wilaya (product page, checkout hints). */
export function feeFrom(desk: boolean) {
  const fees = wilayas.map((w) => deliveryFee(commerce.deliveryFees, w, desk) ?? 0);
  const min = Math.min(...fees);
  return min === Math.max(...fees) ? formatPrice(min) : t("checkout.feeFrom", { fee: formatPrice(min) });
}

type Resolved =
  | { error: "fulfillment_disabled" | "wilaya" }
  | {
      error?: undefined;
      fulfillment: Order["fulfillment"];
      paymentMethod: Order["paymentMethod"];
      fee: number;
      where: Pick<Order["customer"], "wilaya" | "address" | "desk">;
    };

/** Checkout / order-edit choice → order fields and fee (server side). Refuses modes the config turns off. */
export function resolveDelivery(mode: "delivery" | "desk" | "pickup", wilayaCode?: string, address?: string): Resolved {
  const desk = mode === "desk";
  const delivery = mode !== "pickup";
  if ((delivery ? !commerce.deliveryEnabled : !commerce.pickupEnabled) || (desk && !deskEnabled)) return { error: "fulfillment_disabled" };
  if (!delivery) return { fulfillment: "pickup", paymentMethod: "instore", fee: 0, where: {} };
  const w = wilayas.find((x) => x.code === wilayaCode);
  if (!w) return { error: "wilaya" };
  return {
    fulfillment: "delivery",
    paymentMethod: "cod",
    fee: deliveryFee(commerce.deliveryFees, w, desk) ?? 0, // desk is on here, so never null
    where: { wilaya: `${w.code} - ${w.name}`, address, ...(desk && { desk: true }) },
  };
}
