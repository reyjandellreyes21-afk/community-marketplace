import { hasValidCoords } from "./constants.js";
import { searchGeo } from "./geoApi.js";
import { buildProfileGeocodeQuery, resolveProfileGeocodeParts } from "./formatGeo.js";

/**
 * Coordinates for the logged-in user's saved profile address (map pin, else geocoded address).
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function resolveProfileCoords({ user, profileDraft } = {}) {
  if (hasValidCoords(user?.defaultLat, user?.defaultLng)) {
    return { lat: Number(user.defaultLat), lng: Number(user.defaultLng) };
  }

  const parts = resolveProfileGeocodeParts({ profileDraft, user });
  const profileQ = buildProfileGeocodeQuery(parts);
  if (!profileQ) return null;

  let rows = await searchGeo(profileQ, { limit: 1 });
  let hit = rows[0] ?? null;
  if (!hit) {
    const simpleQ = buildProfileGeocodeQuery({ city: parts.city, province: parts.province });
    if (simpleQ && simpleQ !== profileQ) {
      rows = await searchGeo(simpleQ, { limit: 1 });
      hit = rows[0] ?? null;
    }
  }

  if (hit && hasValidCoords(hit.lat, hit.lng)) {
    return { lat: Number(hit.lat), lng: Number(hit.lng) };
  }
  return null;
}
