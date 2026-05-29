import { getApiV1Base } from "../../apiBase.js";

/**
 * CARTO Voyager — reliable public CDN (OSM data). Used by default so maps work
 * without the API tile proxy (ad blockers, server down, etc.).
 */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

export const MAP_TILE_SUBDOMAINS = "abcd";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Same-origin proxy (optional). Enable with VITE_MAP_TILES=api in .env */
export function getApiProxyTileLayerUrl() {
  const base = getApiV1Base().replace(/\/+$/, "");
  return `${base}/geo/tiles/{z}/{x}/{y}.png`;
}

export function useApiProxyTiles() {
  return String(import.meta.env.VITE_MAP_TILES || "").trim().toLowerCase() === "api";
}
