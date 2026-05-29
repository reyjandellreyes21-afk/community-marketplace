/** Default radius for community shop “Near me” browse (km). */
export const NEAR_ME_RADIUS_KM = 8;

/** Country-level default view — full Philippine archipelago when no pin is set. */
export const DEFAULT_MAP_CENTER = { lat: 12.8797, lng: 121.774 };

export const DEFAULT_MAP_ZOOM = 6;

const PH_MIN_LAT = 4.5;
const PH_MAX_LAT = 21.25;
const PH_MIN_LNG = 116;
const PH_MAX_LNG = 127.5;

export function hasValidCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

/** True when coordinates fall within the Philippine archipelago bounding box. */
export function isCoordsInPhilippines(lat, lng) {
  if (!hasValidCoords(lat, lng)) return false;
  const la = Number(lat);
  const ln = Number(lng);
  return la >= PH_MIN_LAT && la <= PH_MAX_LAT && ln >= PH_MIN_LNG && ln <= PH_MAX_LNG;
}

/** Map pin is shown only for valid coordinates inside the Philippines. */
export function hasDisplayableMapPin(lat, lng) {
  return isCoordsInPhilippines(lat, lng);
}
