import { hasValidCoords } from "./constants.js";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km between two WGS84 points. */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  if (!hasValidCoords(lat1, lng1) || !hasValidCoords(lat2, lng2)) return null;
  const la1 = (Number(lat1) * Math.PI) / 180;
  const la2 = (Number(lat2) * Math.PI) / 180;
  const dLa = la2 - la1;
  const dLn = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const a =
    Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLn / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;
  return Number.isFinite(km) ? km : null;
}

/** Human-readable distance for community card footers, e.g. "850 m" or "1.2 km". */
export function formatDistanceLabel(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1) {
    const m = Math.max(1, Math.round(n * 1000));
    return `${m} m`;
  }
  if (n < 10) return `${n.toFixed(1)} km`;
  return `${Math.round(n)} km`;
}

/** Distance from viewer to listing when both have valid coordinates. */
export function listingDistanceLabel(viewerCoords, listing) {
  const lat = listing?.lat;
  const lng = listing?.lng;
  if (!viewerCoords || !hasValidCoords(viewerCoords.lat, viewerCoords.lng)) return "";
  const km = haversineDistanceKm(viewerCoords.lat, viewerCoords.lng, lat, lng);
  return formatDistanceLabel(km);
}
