import { hasValidCoords } from "./constants.js";
import { searchGeo } from "./geoApi.js";
import {
  buildCommunityGeocodeQuery,
  buildProfileGeocodeQuery,
  resolveProfileGeocodeParts,
} from "./formatGeo.js";

/** Text label when geocoding fails but profile locality fields exist. */
export function formatCityLabelFromProfileParts(parts) {
  const bits = [parts?.barangay, parts?.city, parts?.province]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return bits.join(", ").slice(0, 200);
}

async function geocodeFirstHit(q) {
  const query = String(q || "").trim();
  if (!query) return null;
  const rows = await searchGeo(query, { limit: 1 });
  return rows[0] ?? null;
}

/**
 * Product listings: derive meet-up pin from seller profile (default pin → address → community).
 * @returns {Promise<{ lat: number | null, lng: number | null, cityLabel: string }>}
 */
export async function resolveProductListingLocation({ user, profileDraft, activeCommunity } = {}) {
  const parts = resolveProfileGeocodeParts({ profileDraft, user });
  const fallbackLabel = formatCityLabelFromProfileParts(parts);

  if (hasValidCoords(user?.defaultLat, user?.defaultLng)) {
    return {
      lat: Number(user.defaultLat),
      lng: Number(user.defaultLng),
      cityLabel: fallbackLabel || String(user?.community || "").trim().slice(0, 200),
    };
  }

  const profileQ = buildProfileGeocodeQuery(parts);
  if (profileQ) {
    let hit = await geocodeFirstHit(profileQ);
    if (!hit) {
      const simpleQ = buildProfileGeocodeQuery({ city: parts.city, province: parts.province });
      if (simpleQ && simpleQ !== profileQ) hit = await geocodeFirstHit(simpleQ);
    }
    if (hit) {
      return {
        lat: Number(hit.lat),
        lng: Number(hit.lng),
        cityLabel: String(hit.cityLabel || hit.displayName || fallbackLabel).trim().slice(0, 200),
      };
    }
  }

  const commQ = buildCommunityGeocodeQuery(activeCommunity);
  if (commQ) {
    const hit = await geocodeFirstHit(commQ);
    if (hit) {
      return {
        lat: Number(hit.lat),
        lng: Number(hit.lng),
        cityLabel: String(hit.cityLabel || hit.displayName || fallbackLabel).trim().slice(0, 200),
      };
    }
  }

  return { lat: null, lng: null, cityLabel: fallbackLabel };
}
