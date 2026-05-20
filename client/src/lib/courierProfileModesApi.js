import { apiRequest } from "./appApi.js";
import { MODE_ORDER } from "./courierTransportModes.js";

/**
 * Normalize modes from API / PATCH response.
 * @param {unknown} d response body with optional `modes` array
 * @returns {string[]}
 */
export function normalizeCourierModesResponse(d) {
  const raw = Array.isArray(d?.modes) ? d.modes : [];
  return [...new Set(raw.map((x) => String(x || "").trim().toLowerCase()).filter((x) => MODE_ORDER.includes(x)))];
}

/**
 * Persist `profiles.courier_modes` (walk/run/bike/others). Used by neighbor lists and claim flow.
 *
 * @param {string} token
 * @param {string[]} modes
 * @returns {Promise<string[]>} normalized modes from server response
 */
export async function persistCourierModesToProfile(token, modes) {
  const normalized = [
    ...new Set(
      (Array.isArray(modes) ? modes : [])
        .map((x) => String(x || "").trim().toLowerCase())
        .filter((x) => MODE_ORDER.includes(x)),
    ),
  ];
  const d = await apiRequest("/me/courier-modes", {
    method: "PATCH",
    token,
    body: { modes: normalized },
  });
  return normalizeCourierModesResponse(d);
}
