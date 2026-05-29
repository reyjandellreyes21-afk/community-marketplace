import { apiRequest } from "../appApi.js";

/**
 * @param {string} q
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ lat: number, lng: number, displayName: string, cityLabel: string }>>}
 */
export async function searchGeo(q, opts = {}) {
  const qs = new URLSearchParams();
  qs.set("q", String(q || "").trim());
  if (opts.limit != null) qs.set("limit", String(opts.limit));
  const data = await apiRequest(`/geo/search?${qs.toString()}`);
  return Array.isArray(data?.results) ? data.results : [];
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ lat: number, lng: number, displayName: string, cityLabel: string } | null>}
 */
export async function reverseGeo(lat, lng) {
  const qs = new URLSearchParams();
  qs.set("lat", String(lat));
  qs.set("lng", String(lng));
  const data = await apiRequest(`/geo/reverse?${qs.toString()}`);
  return data?.result ?? null;
}
