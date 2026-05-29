import { config } from "../config/config.js";
import { AppError } from "../errors/AppError.js";

const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/** @type {Map<string, { at: number, data: unknown }>} */
const cache = new Map();
let lastRequestAt = 0;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

async function throttle() {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function baseUrl() {
  return String(config.nominatimBaseUrl || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
}

function userAgent() {
  return (
    String(config.nominatimUserAgent || "").trim() ||
    "LinkMart/1.0 (community-marketplace; contact: linkmart-dev@local.invalid)"
  );
}

function normalizeQuery(q) {
  let s = String(q || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (!/philippines/i.test(s)) s = `${s}, Philippines`;
  return s;
}

function cityLabelFromNominatim(row) {
  const addr = row?.address && typeof row.address === "object" ? row.address : {};
  const parts = [
    addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || addr.quarter,
    addr.city || addr.town || addr.municipality || addr.county,
    addr.state || addr.region,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const fromAddr = parts.join(", ");
  if (fromAddr) return fromAddr.slice(0, 200);
  const dn = String(row?.display_name || "").trim();
  if (!dn) return "";
  const bits = dn.split(",").map((x) => x.trim()).filter(Boolean);
  return bits.slice(0, 3).join(", ").slice(0, 200);
}

const PH_MIN_LAT = 4.5;
const PH_MAX_LAT = 21.25;
const PH_MIN_LNG = 116;
const PH_MAX_LNG = 127.5;

function isCoordsInPhilippines(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= PH_MIN_LAT && lat <= PH_MAX_LAT && lng >= PH_MIN_LNG && lng <= PH_MAX_LNG;
}

function mapSearchRow(row) {
  const lat = Number(row?.lat);
  const lng = Number(row?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isCoordsInPhilippines(lat, lng)) return null;
  return {
    lat,
    lng,
    displayName: String(row.display_name || "").trim().slice(0, 500),
    cityLabel: cityLabelFromNominatim(row),
  };
}

async function fetchNominatim(path, queryParams) {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("format", "json");
  await throttle();
  const res = await fetch(url.href, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent(),
    },
  });
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new AppError(502, "Geocoding service returned an invalid response.");
  }
  if (!res.ok) {
    const msg =
      payload?.error ||
      (typeof payload === "string" ? payload : null) ||
      `Geocoding request failed (${res.status}).`;
    throw new AppError(res.status === 429 ? 429 : 502, String(msg).slice(0, 200));
  }
  return payload;
}

/**
 * @param {string} q
 * @param {{ limit?: number }} [opts]
 */
export async function nominatimSearch(q, opts = {}) {
  const query = normalizeQuery(q);
  if (!query) return [];
  const limit = Math.min(10, Math.max(1, Math.floor(Number(opts.limit) || 5)));
  const cacheKey = `search:${query.toLowerCase()}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const rows = await fetchNominatim("/search", {
    q: query,
    limit,
    addressdetails: "1",
    countrycodes: "ph",
  });
  const list = Array.isArray(rows) ? rows : [];
  const out = list.map(mapSearchRow).filter(Boolean);
  cacheSet(cacheKey, out);
  return out;
}

/**
 * @param {number} lat
 * @param {number} lng
 */
export async function nominatimReverse(lat, lng) {
  const latN = Number(lat);
  const lngN = Number(lng);
  const cacheKey = `reverse:${latN.toFixed(5)}:${lngN.toFixed(5)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const row = await fetchNominatim("/reverse", {
    lat: latN,
    lon: lngN,
    addressdetails: "1",
    zoom: "16",
  });
  const mapped = row && typeof row === "object" ? mapSearchRow(row) : null;
  cacheSet(cacheKey, mapped);
  return mapped;
}
