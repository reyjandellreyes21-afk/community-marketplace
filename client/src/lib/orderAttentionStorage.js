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

/**
 * Visible Orders status chips (shared by both My Orders + My Sales views).
 * Underlying storage keys (`RECENT_ORDER_TAB_KEYS`) keep `completed` + `cancelled` split for
 * badge/dismissal bookkeeping; the **History** tab simply unions both.
 */
export const ORDERS_STATUS_TABS = [
  {
    id: "pending",
    label: "Needs Action",
    /** Visible under ~390px — three columns on 360–389 phones */
    shortLabel: "Action",
    hint: "Items waiting for you to act — accept, decline, or take the next step.",
  },
  {
    id: "processing",
    label: "Ongoing",
    shortLabel: "Ongoing",
    hint: "Accepted orders in progress — preparing, courier assignment, pickup, or delivery.",
  },
  {
    id: "history",
    label: "History",
    shortLabel: "Hist.",
    hint: "Finished and cancelled orders — completed pickups/deliveries and declined or cancelled rows.",
  },
];

/** Storage tab keys merged under the visible **History** tab. */
export const HISTORY_ORDER_STATUS_TAB_KEYS = ["completed", "cancelled"];

/** Returns the `ORDERS_STATUS_TABS` entry for `tabId`. */
export const getOrdersStatusTabMeta = (tabId) =>
  ORDERS_STATUS_TABS.find((t) => t.id === tabId) || null;

/** Returns `ORDERS_STATUS_TABS` as a stable array reference. */
export const getOrdersStatusTabs = () => ORDERS_STATUS_TABS;

/**
 * Maps a visible Buying/Selling tab id (`pending`/`processing`/`history`) to the underlying
 * storage tab keys used by `RECENT_ORDER_TAB_KEYS`-shaped state (badge / dismissal records).
 */
export const expandOrdersStatusTabToStorageKeys = (tabId) => {
  if (tabId === "history") return [...HISTORY_ORDER_STATUS_TAB_KEYS];
  return [String(tabId || "")];
};

/** Storage tab id (`completed`/`cancelled`/…) → visible Buying/Selling tab id (`history`/…). */
export const toVisibleOrdersStatusTab = (tabIdOrStatus) => {
  const s = String(tabIdOrStatus || "");
  if (s === "completed" || s === "cancelled") return "history";
  return s;
};

export const orderMatchesOrdersStatusTab = (status, tabId) => {
  const s = String(status || "").toLowerCase();
  /** DB/API use `placed`; treat `pending` as the same queue if it ever appears. */
  if (tabId === "pending") return s === "placed" || s === "pending";
  if (tabId === "completed") return s === "completed";
  if (tabId === "cancelled") return s === "cancelled";
  if (tabId === "history") return s === "completed" || s === "cancelled";
  if (tabId === "processing")
    return Boolean(s) && !["placed", "pending", "completed", "cancelled"].includes(s);
  return false;
};

/**
 * Activity → Booking — same **STATUS** labels as Orders (`Needs Action` / `Ongoing` / `History`);
 * hints stay role-aware (buyer vs provider).
 *
 * Underlying `order.status` / dismiss storage still use `RECENT_ORDER_TAB_KEYS`.
 */
const BOOKING_BUYER_STATUS_TABS = [
  {
    id: "approve",
    label: "Needs Action",
    shortLabel: "Action",
    hint: "Bookings waiting on the provider — approve, decline, or the next step.",
  },
  {
    id: "active",
    label: "Ongoing",
    shortLabel: "Ongoing",
    hint: "Accepted bookings that are in progress.",
  },
  {
    id: "history",
    label: "History",
    shortLabel: "Hist.",
    hint: "Completed and cancelled bookings.",
  },
];

const BOOKING_SELLER_STATUS_TABS = [
  {
    id: "approve",
    label: "Needs Action",
    shortLabel: "Action",
    hint: "Booking requests that need your action — accept or decline.",
  },
  {
    id: "active",
    label: "Ongoing",
    shortLabel: "Ongoing",
    hint: "Bookings you’ve accepted and are currently serving.",
  },
  {
    id: "history",
    label: "History",
    shortLabel: "Hist.",
    hint: "Completed and cancelled bookings.",
  },
];

/** Default export kept for back-compat — buyer-labelled 3-tab strip. */
export const BOOKING_STATUS_TABS = BOOKING_BUYER_STATUS_TABS;

/** @param {"buyer"|"seller"} role */
export const getBookingStatusTabs = (role) =>
  role === "seller" ? BOOKING_SELLER_STATUS_TABS : BOOKING_BUYER_STATUS_TABS;

/** @param {string} status @param {'approve'|'active'|'history'|'past'|'declined'} tabId */
export const orderMatchesBookingStatusTab = (status, tabId) => {
  if (tabId === "approve") {
    return orderMatchesOrdersStatusTab(status, "pending");
  }
  if (tabId === "active") {
    return orderMatchesOrdersStatusTab(status, "processing");
  }
  if (tabId === "history") {
    return (
      orderMatchesOrdersStatusTab(status, "completed") ||
      orderMatchesOrdersStatusTab(status, "cancelled")
    );
  }
  /** Legacy ids — keep matching working for any stale callers. */
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
