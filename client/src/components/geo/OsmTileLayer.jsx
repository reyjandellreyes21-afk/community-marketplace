import { useCallback, useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_SUBDOMAINS,
  MAP_TILE_URL,
  getApiProxyTileLayerUrl,
  useApiProxyTiles,
} from "../../lib/geo/mapTiles.js";
import { MapTileFallbackListener } from "./MapTileFallbackListener.jsx";

/**
 * Map tiles — CARTO CDN by default; optional same-origin API proxy via VITE_MAP_TILES=api.
 */
export function OsmTileLayer() {
  const preferApi = useApiProxyTiles();
  const [useCdn, setUseCdn] = useState(!preferApi);
  const activateCdn = useCallback(() => setUseCdn(true), []);

  useEffect(() => {
    if (!preferApi || useCdn) return undefined;
    let cancelled = false;
    const probe = getApiProxyTileLayerUrl()
      .replace("{z}", "6")
      .replace("{x}", "52")
      .replace("{y}", "28");
    void fetch(probe, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && !res.ok) setUseCdn(true);
      })
      .catch(() => {
        if (!cancelled) setUseCdn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preferApi, useCdn]);

  const url = useCdn ? MAP_TILE_URL : getApiProxyTileLayerUrl();

  return (
    <>
      <TileLayer
        key={useCdn ? "cdn" : "api"}
        url={url}
        attribution={MAP_TILE_ATTRIBUTION}
        subdomains={MAP_TILE_SUBDOMAINS}
        maxZoom={19}
        keepBuffer={4}
        updateWhenZooming={false}
        updateWhenIdle
      />
      {!useCdn ? <MapTileFallbackListener enabled onFallback={activateCdn} /> : null}
    </>
  );
}
