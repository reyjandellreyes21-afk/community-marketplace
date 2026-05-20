/**
 * Activity → **All** (`COMMERCE_ALL`): one visible STATUS lane (Needs Action / Ongoing / History)
 * maps to both product `ordersStatusTab` and booking `bookingOrdersStatusTab`.
 *
 * Product strip ids: `pending` | `processing` | `history`
 * Booking strip ids: `approve` | `active` | `history`
 */

export const COMMERCE_ALL_UNIFIED_STATUS = {
  NEEDS_ACTION: "needs_action",
  ONGOING: "ongoing",
  HISTORY: "history",
};

/** @param {string} ordersTabId */
export function mapOrdersStatusTabToBookingTab(ordersTabId) {
  const s = String(ordersTabId || "");
  if (s === "pending") return "approve";
  if (s === "processing") return "active";
  if (s === "history") return "history";
  return "approve";
}

/** @param {string} unified */
export function unifiedStatusToOrdersStatusTab(unified) {
  const u = String(unified || "");
  if (u === COMMERCE_ALL_UNIFIED_STATUS.NEEDS_ACTION) return "pending";
  if (u === COMMERCE_ALL_UNIFIED_STATUS.ONGOING) return "processing";
  if (u === COMMERCE_ALL_UNIFIED_STATUS.HISTORY) return "history";
  return "pending";
}

/** @param {string} unified */
export function unifiedStatusToBookingOrdersStatusTab(unified) {
  const u = String(unified || "");
  if (u === COMMERCE_ALL_UNIFIED_STATUS.NEEDS_ACTION) return "approve";
  if (u === COMMERCE_ALL_UNIFIED_STATUS.ONGOING) return "active";
  if (u === COMMERCE_ALL_UNIFIED_STATUS.HISTORY) return "history";
  return "approve";
}

/**
 * @param {string} ordersStatusTab
 * @returns {string | null} `COMMERCE_ALL_UNIFIED_STATUS` value or null if not a unified lane
 */
export function ordersStatusTabToUnifiedStatus(ordersStatusTab) {
  const s = String(ordersStatusTab || "");
  if (s === "pending") return COMMERCE_ALL_UNIFIED_STATUS.NEEDS_ACTION;
  if (s === "processing") return COMMERCE_ALL_UNIFIED_STATUS.ONGOING;
  if (s === "history") return COMMERCE_ALL_UNIFIED_STATUS.HISTORY;
  return null;
}
