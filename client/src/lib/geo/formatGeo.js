import { splitAddressParts } from "../philippinesAddress.js";
import { hasValidCoords, isCoordsInPhilippines } from "./constants.js";

export const GEO_NO_RESULTS_MESSAGE =
  "No results for that address. Move the pin on the map or try a simpler search.";

/** Prefer the first geocode hit inside the Philippines. */
export function pickPhilippinesGeoResult(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.find((row) => isCoordsInPhilippines(row?.lat, row?.lng)) ?? null;
}

export function formatCoordsForA11y(lat, lng) {
  if (!hasValidCoords(lat, lng)) return "Location coordinates not set.";
  return `Location: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function formatLocationSummary(cityLabel, lat, lng) {
  const label = String(cityLabel || "").trim();
  if (label && hasValidCoords(lat, lng)) {
    return `${label} (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`;
  }
  if (label) return label;
  return formatCoordsForA11y(lat, lng);
}

/** Merge profile edit draft with saved user row (draft wins when non-empty). */
export function resolveProfileGeocodeParts({ profileDraft, user } = {}) {
  const fromUser = user?.address ? splitAddressParts(user.address) : {};
  const draft = profileDraft && typeof profileDraft === "object" ? profileDraft : {};
  const pick = (draftKey, userKey) => {
    const fromDraft = String(draft[draftKey] || "").trim();
    if (fromDraft) return fromDraft;
    return String(fromUser[userKey] || "").trim();
  };
  const community = String(draft.community || user?.community || "").trim();
  const barangay = pick("addressBarangay", "addressBarangay") || community;
  return {
    houseStreet: pick("addressHouseStreet", "addressHouseStreet"),
    subdivision: pick("addressSubdivision", "addressSubdivision"),
    barangay,
    city: pick("addressCity", "addressCity"),
    province: pick("addressProvince", "addressProvince"),
    postalCode: pick("addressPostalCode", "addressPostalCode"),
  };
}

/** Build a geocode query from profile address parts (needs at least one locality field). */
export function buildProfileGeocodeQuery({
  houseStreet,
  subdivision,
  barangay,
  city,
  province,
  postalCode,
} = {}) {
  const locality = [houseStreet, subdivision, barangay, city, province, postalCode]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (locality.length === 0) return "";
  return [...locality, "Philippines"].join(", ");
}

/** Build query from community row (name + locale). */
export function buildCommunityGeocodeQuery(community) {
  if (!community || typeof community !== "object") return "";
  const name = String(community.name || "").trim();
  const city = String(community.city || "").trim();
  const province = String(community.province || "").trim();
  const postal = String(community.postalCode || "").trim();
  const parts = [name, city, province, postal, "Philippines"].filter(Boolean);
  return parts.join(", ");
}
