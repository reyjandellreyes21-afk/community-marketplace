import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Keep map centered when pin moves (MapContainer `center` is initial-only).
 * @param {boolean} [preserveZoom=true] — pan only; keep the user's current zoom (pin drag, scroll zoom).
 * @param {boolean} [applyZoom=false] — use `zoom` prop (search result, "use my location", first placement).
 */
export function MapViewSync({ center, zoom, preserveZoom = true, applyZoom = false }) {
  const map = useMap();
  const lat = Number(center?.[0]);
  const lng = Number(center?.[1]);
  const z = Number(zoom);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      if (applyZoom && Number.isFinite(z)) {
        map.setView([lat, lng], z, { animate: false });
        return;
      }
      if (preserveZoom) {
        map.panTo([lat, lng], { animate: false });
        return;
      }
      if (Number.isFinite(z)) {
        map.setView([lat, lng], z, { animate: false });
      }
    } catch {
      /* unmounting */
    }
  }, [map, lat, lng, z, preserveZoom, applyZoom]);

  return null;
}
