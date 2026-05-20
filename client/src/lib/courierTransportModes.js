/** Walk / run / bike / others — matches server `resolveCourierAssignmentMode`. */

export const MODE_ORDER = ["walk", "run", "bike", "others"];

export const MODE_LABEL = { walk: "Walk", run: "Run", bike: "Bike", others: "Others" };

/** Same default priority as server `resolveCourierAssignmentMode` when no explicit mode is chosen. */
export function defaultClaimModeFromProfile(modes) {
  const m = Array.isArray(modes) ? modes : [];
  if (m.includes("bike")) return "bike";
  if (m.includes("run")) return "run";
  if (m.includes("walk")) return "walk";
  if (m.includes("others")) return "others";
  return "walk";
}
