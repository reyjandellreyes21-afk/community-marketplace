import { useMemo } from "react";
import { MapContainer, Marker } from "react-leaflet";
import { MapInvalidateSize } from "./MapInvalidateSize.jsx";
import { MapViewSync } from "./MapViewSync.jsx";
import { OsmTileLayer } from "./OsmTileLayer.jsx";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, hasValidCoords } from "../../lib/geo/constants.js";
import { formatLocationSummary } from "../../lib/geo/formatGeo.js";
import { OsmAttribution } from "./OsmAttribution.jsx";

import "leaflet/dist/leaflet.css";

// Fix default marker paths in Vite bundles
// eslint-disable-next-line no-underscore-dangle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/**
 * Read-only map for product detail / inspect.
 */
export function ListingLocationMap({
  lat,
  lng,
  cityLabel,
  className = "",
  interactive = false,
  /** Fixed height — do not use min-h + height:100% (Leaflet panes escape in flex scroll parents). */
  heightClass = "h-[200px] md:h-[220px]",
}) {
  const ok = hasValidCoords(lat, lng);
  const center = useMemo(
    () => (ok ? [Number(lat), Number(lng)] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]),
    [lat, lng, ok],
  );
  const a11y = formatLocationSummary(cityLabel, lat, lng);

  if (!ok) {
    return (
      <div className={`rounded-xl border border-dashed border-neutral-300/90 bg-neutral-50/80 px-3 py-4 text-sm text-text-secondary dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-400 ${className}`}>
        <p>Location not set for this listing.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="sr-only">{a11y}</p>
      <p className="mb-2 text-xs text-text-secondary dark:text-slate-400">{cityLabel || a11y}</p>
      <div
        className={`lm-listing-map-shell relative isolate overflow-hidden rounded-xl border border-neutral-200/90 ring-1 ring-black/[0.04] dark:border-slate-600 dark:ring-white/5 ${heightClass} ${
          interactive ? "" : "pointer-events-none"
        }`}
      >
        <MapContainer
          center={center}
          zoom={15}
          scrollWheelZoom={interactive}
          dragging={interactive}
          doubleClickZoom={interactive}
          touchZoom={interactive}
          className="z-0 h-full w-full"
        >
          <OsmTileLayer />
          <MapViewSync center={center} zoom={15} />
          <MapInvalidateSize deps={[lat, lng]} />
          <Marker position={center} />
        </MapContainer>
      </div>
      <OsmAttribution className="mt-1.5" />
    </div>
  );
}
