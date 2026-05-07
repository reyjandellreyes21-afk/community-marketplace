/** Ordered plan tiers for minimum-tier checks (basic < pro < premium). */

const ORDER = { basic: 0, pro: 1, premium: 2 };

export function normalizeSubscriptionTier(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "pro") return "pro";
  if (s === "premium") return "premium";
  return "basic";
}

export function subscriptionTierRank(tier) {
  const key = normalizeSubscriptionTier(tier);
  return ORDER[key] ?? 0;
}

export function meetsMinSubscriptionTier(userTier, minTier) {
  return subscriptionTierRank(userTier) >= subscriptionTierRank(minTier);
}
