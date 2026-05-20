const ORDER = { basic: 0, pro: 1, premium: 2 };

export function normalizeSubscriptionTier(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "pro") return "pro";
  if (s === "premium") return "premium";
  return "basic";
}

export function subscriptionTierRank(tier) {
  return ORDER[normalizeSubscriptionTier(tier)] ?? 0;
}

export function meetsMinSubscriptionTier(userTier, minTier) {
  return subscriptionTierRank(userTier) >= subscriptionTierRank(minTier);
}

const LABELS = { basic: "Basic", pro: "Pro", premium: "Premium" };

export function formatSubscriptionTierLabel(tier) {
  return LABELS[normalizeSubscriptionTier(tier)] ?? "Basic";
}
