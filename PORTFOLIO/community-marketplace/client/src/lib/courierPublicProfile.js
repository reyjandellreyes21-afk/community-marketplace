/** Labels shared by courier neighbor-facing UI (assignment list, profile preview). */

export const COURIER_OPTIONAL_TAG_LABEL = {
  eco: "Eco",
  bike: "Bike",
  fast: "Fast",
  helping: "Helping",
};

const MODE_DISPLAY = {
  walk: "Walk",
  run: "Run",
  bike: "Bike",
};

/**
 * @param {unknown} modes
 * @returns {string | null}
 */
export function formatCourierModesForDisplay(modes) {
  if (!Array.isArray(modes) || modes.length === 0) return null;
  return modes
    .map((m) => {
      const key = String(m || "").trim().toLowerCase();
      return MODE_DISPLAY[key] || key.charAt(0).toUpperCase() + key.slice(1);
    })
    .join(", ");
}

/**
 * Human-readable status as buyers/sellers see it on neighbor courier cards.
 *
 * @param {string} status
 */
export function courierNeighborStatusSummary(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "active") return "Active — on the move";
  if (s === "busy") return "On a delivery — busy";
  if (s === "available") return "Available";
  return "Off — not listed for neighbors";
}

/**
 * @param {number | null | undefined} cents
 * @returns {string | null}
 */
export function formatSuggestedCompensationPesos(cents) {
  if (cents == null || !Number.isFinite(Number(cents))) return null;
  const pesos = Math.max(0, Number(cents)) / 100;
  const s = pesos.toLocaleString(undefined, {
    minimumFractionDigits: pesos % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `₱${s}`;
}
