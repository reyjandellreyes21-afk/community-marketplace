/** Walk / run / bike — matches server `resolveCourierAssignmentMode`. */

export const MODE_ORDER = ["walk", "run", "bike"];

export const MODE_LABEL = { walk: "Walk", run: "Run", bike: "Bike" };

/** Same default priority as server `resolveCourierAssignmentMode` when no explicit mode is chosen. */
export function defaultClaimModeFromProfile(modes) {
  const m = Array.isArray(modes) ? modes : [];
  if (m.includes("bike")) return "bike";
  if (m.includes("run")) return "run";
  return "walk";
}
