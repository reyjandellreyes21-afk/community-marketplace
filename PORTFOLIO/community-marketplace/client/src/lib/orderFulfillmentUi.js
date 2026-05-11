/**
 * Order-card banner line (above primary actions) + delivery-flow predicates.
 *
 * ## Delivery (fulfillment_type === "delivery")
 *
 * | Concept              | Stored status       | Seller / buyer banner | Buttons |
 * |----------------------|---------------------|----------------------|---------|
 * | Seller preparing     | `seller_accepted`   | Preparing / Seller is preparing… | Seller: **I’ll deliver myself** |
 * | Courier assigned     | `courier_assigned`  | (same preparing copy) | Seller: **Out for Delivery** |
 * | In transit           | `out_for_delivery`  | Out for Delivery      | Buyer: **Mark as Received** |
 *
 * Pickup uses `seller_accepted` / `ready_for_pickup` instead.
 *
 * Non-transport **service** bookings reuse pickup milestones (`ready_for_pickup`, buyer ack) even when
 * the legacy row used `fulfillment_type === "delivery"` — see `isAppointmentStyleServiceOrder`.
 *
 * @param {{ status?: string, fulfillmentType?: string, listingVerticalId?: string, listingSubId?: string }} order
 */

function isTransportServiceOrder(order) {
  return (
    String(order?.listingVerticalId || "")
      .trim()
      .toLowerCase() === "services" && String(order?.listingSubId || "").trim() === "transport_services"
  );
}

function isAppointmentStyleServiceOrder(order) {
  return (
    String(order?.listingVerticalId || "")
      .trim()
      .toLowerCase() === "services" && !isTransportServiceOrder(order)
  );
}

/** Delivery + courier assigned (internal `courier_assignments` row); seller marks shipment next. */
export function isDeliveryCourierAssigned(order) {
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "courier_assigned";
}

/** Delivery + seller accepted — waiting for seller self-delivery or community courier assign/claim. */
export function isDeliverySellerPreparing(order) {
  if (isAppointmentStyleServiceOrder(order)) return false;
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "seller_accepted";
}

/** Delivery order is with the courier / on the way (buyer can confirm receipt). */
export function isDeliveryInTransit(order) {
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";
  if (ft !== "delivery") return false;
  return String(order?.status || "").toLowerCase() === "out_for_delivery";
}

/**
 * Visual bucket for the order-card fulfillment banner (pill + icon on Activity orders).
 * Aligns with {@link orderFulfillmentBannerText}; returns `null` when there is no banner.
 *
 * @returns {"preparing" | "ready_pickup" | "out_delivery" | null}
 */
export function orderFulfillmentBannerKind(order) {
  const status = String(order?.status || "").toLowerCase();
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";

  if (status === "seller_accepted" && (ft === "pickup" || isAppointmentStyleServiceOrder(order))) return "preparing";
  if (isDeliverySellerPreparing(order) || isDeliveryCourierAssigned(order)) return "preparing";
  if (status === "ready_for_pickup" && (ft === "pickup" || isAppointmentStyleServiceOrder(order))) return "ready_pickup";
  if (isDeliveryInTransit(order)) return "out_delivery";
  return null;
}

/**
 * @param {"buyer" | "seller"} viewerRole
 */
export function orderFulfillmentBannerText(order, viewerRole) {
  const status = String(order?.status || "").toLowerCase();
  const ft = order?.fulfillmentType === "delivery" ? "delivery" : "pickup";

  if (status === "seller_accepted" && (ft === "pickup" || isAppointmentStyleServiceOrder(order))) {
    if (isAppointmentStyleServiceOrder(order)) {
      return viewerRole === "seller" ? "Booking confirmed" : "Your booking was accepted";
    }
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (isDeliverySellerPreparing(order) || isDeliveryCourierAssigned(order)) {
    return viewerRole === "seller" ? "Preparing" : "Seller is preparing your order";
  }
  if (status === "ready_for_pickup" && (ft === "pickup" || isAppointmentStyleServiceOrder(order))) {
    return isAppointmentStyleServiceOrder(order) ? "Ready for appointment" : "Ready for Pickup";
  }
  if (isDeliveryInTransit(order)) {
    return isAppointmentStyleServiceOrder(order) ? "Appointment in progress" : "Out for Delivery";
  }
  return null;
}
