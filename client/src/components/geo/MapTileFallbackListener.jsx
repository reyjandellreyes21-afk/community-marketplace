import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Switch tile source when API proxy tiles fail (must not pass eventHandlers into Leaflet TileLayer options). */
export function MapTileFallbackListener({ enabled, errorThreshold = 2, onFallback }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return undefined;
    let errors = 0;
    const onTileError = () => {
      errors += 1;
      if (errors >= errorThreshold) onFallback();
    };
    map.on("tileerror", onTileError);
    return () => {
      map.off("tileerror", onTileError);
    };
  }, [map, enabled, errorThreshold, onFallback]);

  return null;
}
