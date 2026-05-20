import { RECENT_ORDER_TAB_KEYS } from "./orderAttentionStorage.js";

/** @typedef {{ count: number, rose: boolean }} ActivityNavBadge */

export function clampNavBadgeCount(n) {
  return Math.min(99, Math.max(0, Math.floor(Number(n) || 0)));
}

/** Sum unseen order ids across storage tabs (`pending` … `cancelled`). */
export function unseenTotalAcrossTabs(idsByTab, tabKeys = RECENT_ORDER_TAB_KEYS) {
  if (!idsByTab || typeof idsByTab !== "object") return 0;
  return tabKeys.reduce((s, tab) => s + (idsByTab[tab]?.length || 0), 0);
}

/**
 * Red (unseen) wins; otherwise seen (slate) queue depth; otherwise hidden.
 * @param {number} unseenTotal
 * @param {number} seenFallbackCount Active pipeline rows when all dismissed (excludes history for role badges).
 * @returns {ActivityNavBadge}
 */
export function buildCommerceNavBadge(unseenTotal, seenFallbackCount) {
  const unseen = clampNavBadgeCount(unseenTotal);
  const fallback = clampNavBadgeCount(seenFallbackCount);
  if (unseen > 0) return { count: unseen, rose: true };
  if (fallback > 0) return { count: fallback, rose: false };
  return { count: 0, rose: false };
}

/** Merge workspace/role badges: sum counts, rose if any slice is rose. */
export function mergeNavBadges(...badges) {
  let count = 0;
  let rose = false;
  for (const b of badges) {
    if (!b || typeof b !== "object") continue;
    count += clampNavBadgeCount(b.count);
    rose = rose || Boolean(b.rose);
  }
  return { count: clampNavBadgeCount(count), rose };
}
