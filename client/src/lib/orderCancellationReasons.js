/** Stable API / DB codes for PATCH `cancellationReason`. */
export const ORDER_CANCELLATION_REASON_IDS = [
  "change_of_mind",
  "change_variant",
  "better_price_elsewhere",
  "placed_by_mistake",
  "other",
];

export const ORDER_CANCELLATION_REASON_OPTIONS = [
  { id: "change_of_mind", label: "Change of mind" },
  { id: "change_variant", label: "Change of variant" },
  { id: "better_price_elsewhere", label: "Found a better price elsewhere" },
  { id: "placed_by_mistake", label: "Order placed by mistake" },
  { id: "other", label: "Others (optional note)" },
];

export function cancellationReasonLabel(reasonId) {
  const id = String(reasonId || "").trim();
  const hit = ORDER_CANCELLATION_REASON_OPTIONS.find((o) => o.id === id);
  return hit ? hit.label : id;
}

/**
 * Who initiated cancellation (relative to viewer when `viewerRole` is set).
 * @returns {string|null}
 */
export function cancellationByLabel(order, viewerRole) {
  const by = order?.cancelledByRole ?? order?.cancelled_by_role;
  const vr = String(viewerRole || "").trim();
  if (by === "buyer") return vr === "buyer" ? "You (buyer)" : "Buyer";
  if (by === "seller") return vr === "seller" ? "You (seller)" : "Seller";
  return null;
}

/**
 * Human-readable reason (+ note for `other`).
 * @returns {string|null}
 */
export function cancellationReasonDisplay(order) {
  const reasonRaw = order?.cancellationReason ?? order?.cancellation_reason;
  const note = String(order?.cancellationNote ?? order?.cancellation_note ?? "").trim();
  const rl = reasonRaw ? cancellationReasonLabel(reasonRaw) : "";
  if (!rl && !note) return null;
  const reason = String(reasonRaw || "").trim();
  if (reason === "other") {
    if (note) return `${rl}: ${note}`;
    return rl;
  }
  if (rl && note) return `${rl} · ${note}`;
  return rl || null;
}

/**
 * @param {object} order — API order row
 * @param {"buyer"|"seller"|null|undefined} viewerRole — when null, labels stay neutral (“Buyer” / “Seller”).
 */
export function describeCancellationForViewer(order, viewerRole) {
  const who = cancellationByLabel(order, viewerRole);
  const reasonLine = cancellationReasonDisplay(order);
  const hasRole = Boolean(order?.cancelledByRole ?? order?.cancelled_by_role);
  const hasReasonCode = Boolean(order?.cancellationReason ?? order?.cancellation_reason);
  const parts = [];
  if (who) parts.push(`Cancelled by ${who}`);
  else parts.push("Cancelled");
  if (reasonLine) {
    parts.push(reasonLine);
  } else if (!hasRole && !hasReasonCode) {
    parts.push("Details not recorded");
  } else if (hasRole && !hasReasonCode) {
    parts.push("Reason not recorded");
  }
  return parts.join(" · ");
}
