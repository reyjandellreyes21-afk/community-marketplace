/**
 * Order-card banner line (above primary actions) + delivery-flow predicates.
 *
 * ## Delivery (fulfillment_type === "delivery") — **product** orders only
 *
 * | Concept              | Stored status       | Seller / buyer banner | Buttons |
 * |----------------------|---------------------|----------------------|---------|
 * | Seller preparing     | `seller_accepted`   | Preparing / Seller is preparing… | Seller: **I’ll deliver myself** |
 * | Courier assigned     | `courier_assigned`  | (same preparing copy) | Seller: **Out for Delivery** |
 * | In transit           | `out_for_delivery`  | Out for Delivery      | Buyer: **Mark as Received** |
 *
 * Pickup uses `seller_accepted` / `ready_for_pickup` instead.
 *
 * ## Service bookings (all service-vertical orders, **including** transport)
 *
 * Five stages — Pending → Confirmed → On The Way → In Progress → Completed — drive the booking-only
 * pipeline. Stored statuses:
 *
 * | Stage        | Stored status          | Buyer banner            | Seller banner            |
 * |--------------|------------------------|--------------------------|--------------------------|
 * | Pending      | `placed`               | Waiting confirmation     | Awaiting your response   |
 * | Confirmed    | `seller_accepted`      | Your booking was accepted | Booking confirmed        |
 * | On The Way   | `provider_on_the_way`  | Provider is on the way   | On the way               |
 * | In Progress  | `ready_for_pickup`     | Ongoing                  | In progress              |
 * | Completed    | `completed`            | (review CTA)             | —                        |
 *
 * @param {{ status?: string, fulfillmentType?: string, listingVerticalId?: string, listingSubId?: string }} order
 */

import { orderIsServiceListingBooking } from "./listingServiceCardMeta.js";

/** Service booking — provider is en route to the buyer (`provider_on_the_way`). No map/ETA. */
export function isServiceProviderOnTheWay(order) {
  if (!orderIsServiceListingBooking(order)) return false;
  return String(order?.status || "").toLowerCase() === "provider_on_the_way";
}

/** Delivery + courier assigned (internal `courier_assignments` row); seller marks shipment next. */
export function isDeliveryCourierAssigned(order) {
  if (orderIsServiceListingBooking(order)) return false;
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "courier_assigned";
}

/** Delivery + seller accepted — waiting for seller self-delivery or community courier assign/claim. */
export function isDeliverySellerPreparing(order) {
  if (orderIsServiceListingBooking(order)) return false;
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "seller_accepted";
}

/** Delivery order is with the courier / on the way (buyer can confirm receipt). */
export function isDeliveryInTransit(order) {
  if (orderIsServiceListingBooking(order)) return false;
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "out_for_delivery";
}

/**
 * Visual bucket for the order-card fulfillment banner (pill + icon on Activity orders).
 * Aligns with {@link orderFulfillmentBannerText}; returns `null` when there is no banner.
 *
 * `on_the_way` is service-booking only — the icon renderer in `App.jsx` falls through to the
 * generic transit glyph for any kind it doesn't special-case, which is the desired visual.
 *
 * @returns {"preparing" | "ready_pickup" | "out_delivery" | "on_the_way" | null}
 */
export function orderFulfillmentBannerKind(order) {
  const status = String(order?.status || "").toLowerCase();
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  const isServiceBooking = orderIsServiceListingBooking(order);

  /** Service bookings show a "waiting" pill on `placed` so the buyer knows the provider hasn't responded yet. */
  if (isServiceBooking && status === "placed") return "preparing";
  if (status === "seller_accepted" && (ft === "pickup" || isServiceBooking)) return "preparing";
  if (isDeliverySellerPreparing(order) || isDeliveryCourierAssigned(order)) return "preparing";
  if (isServiceProviderOnTheWay(order)) return "on_the_way";
  if (status === "ready_for_pickup" && (ft === "pickup" || isServiceBooking)) return "ready_pickup";
  if (isDeliveryInTransit(order)) return "out_delivery";
  return null;
}

/**
 * @param {"buyer" | "seller"} viewerRole
 */
export function orderFulfillmentBannerText(order, viewerRole) {
  const status = String(order?.status || "").toLowerCase();
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  const isServiceBooking = orderIsServiceListingBooking(order);

  if (isServiceBooking && status === "placed") {
    return viewerRole === "seller" ? "Awaiting your response" : "Waiting confirmation";
  }
  if (status === "seller_accepted" && (ft === "pickup" || isServiceBooking)) {
    if (isServiceBooking) {
      return viewerRole === "seller" ? "Booking confirmed" : "Your booking was accepted";
    }
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (isDeliverySellerPreparing(order) || isDeliveryCourierAssigned(order)) {
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (isServiceProviderOnTheWay(order)) {
    return viewerRole === "seller" ? "On the way" : "Provider is on the way";
  }
  if (status === "ready_for_pickup" && (ft === "pickup" || isServiceBooking)) {
    if (isServiceBooking) {
      return viewerRole === "seller" ? "In progress" : "Ongoing";
    }
    return "Ready for Pickup";
  }
  if (isDeliveryInTransit(order)) {
    return isServiceBooking ? "Appointment in progress" : "Out for Delivery";
  }
  return null;
}
