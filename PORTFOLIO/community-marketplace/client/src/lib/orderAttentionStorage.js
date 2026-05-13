import { apiRequest } from "./appApi.js";

export const PURCHASES_PENDING_BADGE_STORAGE_KEY = "lm_recent_pending_purchase_ids_v1";
export const PURCHASES_RECENT_STATUS_HIGHLIGHT_STORAGE_KEY = "lm_recent_status_highlight_ids_by_tab_v1";
export const PURCHASES_RECENT_STATUS_BADGE_STORAGE_KEY = "lm_recent_status_badge_ids_by_tab_v1";
export const SELLER_PENDING_BADGE_STORAGE_KEY = "lm_recent_pending_seller_order_ids_v1";
export const SELLER_RECENT_STATUS_HIGHLIGHT_STORAGE_KEY = "lm_seller_recent_status_highlight_ids_by_tab_v1";
export const SELLER_RECENT_STATUS_BADGE_STORAGE_KEY = "lm_seller_recent_status_badge_ids_by_tab_v1";
/** @deprecated Legacy “recently added” cart lines — replaced by per-user seen IDs (`cartSeenListingIdsStorageKey`). */
export const CART_RECENT_BADGE_STORAGE_KEY = "lm_recent_cart_listing_ids_v1";

/** Per-user: listing IDs marked seen after leaving Cart (same dismissal model as order tabs). */
export const cartSeenListingIdsStorageKey = (userId) =>
  `lm_cart_seen_listing_ids_v1:${String(userId || "")}`;
/** Per-user: favorite listing IDs marked seen after leaving Favorites. */
export const favoritesSeenListingIdsStorageKey = (userId) =>
  `lm_favorites_seen_listing_ids_v1:${String(userId || "")}`;
/** Last chosen quick-buy fulfillment (pickup | delivery) for listings that support it. */
export const QUICK_ORDER_FULFILLMENT_PREF_KEY = "lm_quick_order_fulfillment_pref_v1";

export const readQuickOrderFulfillmentPref = () => {
  try {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(QUICK_ORDER_FULFILLMENT_PREF_KEY);
    if (v === "pickup" || v === "delivery") return v;
    return null;
  } catch {
    return null;
  }
};

export const writeQuickOrderFulfillmentPref = (value) => {
  try {
    if (typeof window === "undefined") return;
    if (value === "pickup" || value === "delivery") {
      window.localStorage.setItem(QUICK_ORDER_FULFILLMENT_PREF_KEY, value);
    }
  } catch {
    // ignore
  }
};

/** Per-user: order ids the buyer has “seen” (dismissed) per status tab — source of truth for Buying badges/highlights. */
export const buyerOrderDismissedStorageKey = (userId) =>
  `lm_buyer_order_dismissed_by_tab_v1:${String(userId || "")}`;
/** Per-user: same for seller-side queues / Selling nav. */
export const sellerOrderDismissedStorageKey = (userId) =>
  `lm_seller_order_dismissed_by_tab_v1:${String(userId || "")}`;

export const readStoredStringArray = (key) => {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const RECENT_ORDER_TAB_KEYS = ["pending", "processing", "completed", "cancelled"];

export const emptyOrderAttentionByTab = () => ({
  pending: [],
  processing: [],
  completed: [],
  cancelled: [],
});

export const persistBuyerOrderAttentionToStorage = () => {
  try {
    if (typeof window === "undefined") return;
    const empty = emptyOrderAttentionByTab();
    window.localStorage.setItem(PURCHASES_RECENT_STATUS_BADGE_STORAGE_KEY, JSON.stringify(empty));
    window.localStorage.setItem(PURCHASES_RECENT_STATUS_HIGHLIGHT_STORAGE_KEY, JSON.stringify(empty));
    window.localStorage.setItem(PURCHASES_PENDING_BADGE_STORAGE_KEY, JSON.stringify([]));
  } catch {
    // ignore
  }
};

export const readStoredRecentIdsByTab = (key) => {
  const empty = { pending: [], processing: [], completed: [], cancelled: [] };
  try {
    if (typeof window === "undefined") return empty;
    const raw = window.localStorage.getItem(key);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      pending: Array.isArray(parsed?.pending) ? parsed.pending.map((x) => String(x || "")).filter(Boolean) : [],
      processing: Array.isArray(parsed?.processing) ? parsed.processing.map((x) => String(x || "")).filter(Boolean) : [],
      completed: Array.isArray(parsed?.completed) ? parsed.completed.map((x) => String(x || "")).filter(Boolean) : [],
      cancelled: Array.isArray(parsed?.cancelled) ? parsed.cancelled.map((x) => String(x || "")).filter(Boolean) : [],
    };
  } catch {
    return empty;
  }
};

export const normalizeAttentionIdsByTabObject = (raw) => {
  const empty = emptyOrderAttentionByTab();
  if (!raw || typeof raw !== "object") return empty;
  for (const t of RECENT_ORDER_TAB_KEYS) {
    empty[t] = Array.isArray(raw[t]) ? raw[t].map((x) => String(x || "")).filter(Boolean) : [];
  }
  return empty;
};

export const normalizeRecentPendingIdsFromApi = (raw) =>
  Array.isArray(raw) ? raw.map((x) => String(x || "")).filter(Boolean) : [];

export const ORDERS_STATUS_TABS = [
  {
    id: "pending",
    label: "Pending",
    /** Visible under ~390px — four columns on 360–389 phones */
    shortLabel: "Pend.",
    hint: "Waiting for the seller to accept, or for your next step.",
  },
  {
    id: "processing",
    label: "Processing",
    shortLabel: "Proc.",
    hint: "In progress — preparing, courier assignment, pickup, or delivery.",
  },
  {
    id: "completed",
    label: "Completed",
    shortLabel: "Done",
    hint: "Finished orders — picked up or delivered.",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    shortLabel: "Canc.",
    hint: "Declined or cancelled orders.",
  },
];

export const orderMatchesOrdersStatusTab = (status, tabId) => {
  const s = String(status || "").toLowerCase();
  /** DB/API use `placed`; treat `pending` as the same queue if it ever appears. */
  if (tabId === "pending") return s === "placed" || s === "pending";
  if (tabId === "completed") return s === "completed";
  if (tabId === "cancelled") return s === "cancelled";
  if (tabId === "processing")
    return Boolean(s) && !["placed", "pending", "completed", "cancelled"].includes(s);
  return false;
};

/**
 * Activity → Booking: **Pending** (placed), **Active** (processing), **Completed**, **Cancelled**.
 * Underlying `order.status` / dismiss storage still use `RECENT_ORDER_TAB_KEYS`.
 */
export const BOOKING_STATUS_TABS = [
  {
    id: "approve",
    label: "Pending",
    shortLabel: "Pending",
    hint: "Service bookings waiting for provider acceptance, or your request is still pending.",
  },
  {
    id: "active",
    label: "Active",
    shortLabel: "Active",
    hint: "Accepted bookings in progress (same queue as Processing for product orders).",
  },
  {
    id: "past",
    label: "Completed",
    shortLabel: "Done",
    hint: "Completed bookings.",
  },
  {
    id: "declined",
    label: "Cancelled",
    shortLabel: "Canc.",
    hint: "Cancelled or declined bookings.",
  },
];

/** @param {string} status @param {'approve'|'active'|'past'|'declined'} tabId */
export const orderMatchesBookingStatusTab = (status, tabId) => {
  if (tabId === "approve") {
    return orderMatchesOrdersStatusTab(status, "pending");
  }
  if (tabId === "active") {
    return orderMatchesOrdersStatusTab(status, "processing");
  }
  if (tabId === "past") return orderMatchesOrdersStatusTab(status, "completed");
  if (tabId === "declined") return orderMatchesOrdersStatusTab(status, "cancelled");
  return false;
};

/** Matches bulk Accept / Cancel eligibility in Bookings (see `ordersAcceptEnabled` / `ordersDeclineEnabled` in App). */
export const orderStatusEligibleForServiceBookingBulkActions = (status) =>
  String(status || "").toLowerCase() === "placed";

export const orderStatusToTabId = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "placed" || s === "pending") return "pending";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return s ? "processing" : "";
};

/** Matches server `normalizeOrderIdList` cap — avoids oversized payloads on PUT /me/order-attention. */
export const MAX_ORDER_ATTENTION_IDS_PER_LIST = 400;

const clampOrderIdList = (arr) => {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const id = String(x || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_ORDER_ATTENTION_IDS_PER_LIST) break;
  }
  return out;
};

/**
 * Union dismissed (“seen”) order ids per tab — used when merging local cache with GET /me/order-attention.
 */
export const mergeDismissedIdsByTab = (a, b) => {
  const out = emptyOrderAttentionByTab();
  for (const t of RECENT_ORDER_TAB_KEYS) {
    const set = new Set();
    for (const id of [...(a?.[t] ?? []), ...(b?.[t] ?? [])]) {
      const s = String(id || "").trim();
      if (s) set.add(s);
    }
    out[t] = clampOrderIdList(Array.from(set));
  }
  return out;
};

/**
 * Parses one side of GET /me/order-attention into dismissed ids per tab.
 * Uses union of `badgeIdsByTab` and `highlightIdsByTab` so older rows remain compatible.
 */
export const attentionApiSideToDismissed = (side) => {
  if (!side || typeof side !== "object") return emptyOrderAttentionByTab();
  const badge = normalizeAttentionIdsByTabObject(side.badgeIdsByTab ?? side.badge_ids_by_tab);
  const highlight = normalizeAttentionIdsByTabObject(side.highlightIdsByTab ?? side.highlight_ids_by_tab);
  return mergeDismissedIdsByTab(badge, highlight);
};

/**
 * Builds the JSON shape for PUT /me/order-attention (`buyer_attention` / `seller_attention` stored fields).
 * `badgeIdsByTab` holds dismissed order ids per tab (same semantics as client localStorage).
 */
export const dismissedByTabToAttentionSidePayload = (dismissedByTab) => {
  const badgeIdsByTab = emptyOrderAttentionByTab();
  for (const t of RECENT_ORDER_TAB_KEYS) {
    badgeIdsByTab[t] = clampOrderIdList(Array.isArray(dismissedByTab?.[t]) ? dismissedByTab[t] : []);
  }
  const pending = badgeIdsByTab.pending ?? [];
  return {
    badgeIdsByTab,
    highlightIdsByTab: emptyOrderAttentionByTab(),
    recentPendingIds: clampOrderIdList(pending),
  };
};

export async function fetchOrderAttentionFromApi(token) {
  return apiRequest("/me/order-attention", { token });
}

export async function putOrderAttentionToApi(token, buyerDismissedByTab, sellerDismissedByTab) {
  const body = {
    buyer: dismissedByTabToAttentionSidePayload(buyerDismissedByTab),
    seller: dismissedByTabToAttentionSidePayload(sellerDismissedByTab),
  };
  await apiRequest("/me/order-attention", { method: "PUT", token, body });
}
