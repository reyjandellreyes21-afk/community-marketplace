/**
 * Banner line under each order card (above primary actions).
 * Maps DB statuses to product copy. Conceptual spec ↔ stored status:
 * - WAITING_FOR_SELLER + pickup → `seller_accepted`
 * - WAITING_FOR_BUYER + pickup → `ready_for_pickup`
 * - WAITING_FOR_SELLER + delivery → `bid_accepted` (after bid accepted)
 * - IN_TRANSIT + delivery → `out_for_delivery`
 *
 * @param {{ status?: string, fulfillmentType?: string }} order
 * @param {"buyer" | "seller"} viewerRole
 */
export function orderFulfillmentBannerText(order, viewerRole) {
  const status = String(order?.status || "").toLowerCase();
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";

  if (status === "seller_accepted" && ft === "pickup") {
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (status === "bid_accepted" && ft === "delivery") {
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (status === "ready_for_pickup" && ft === "pickup") {
    return "Ready for Pickup";
  }
  if (status === "out_for_delivery" && ft === "delivery") {
    return "Out for Delivery";
  }
  return null;
}
