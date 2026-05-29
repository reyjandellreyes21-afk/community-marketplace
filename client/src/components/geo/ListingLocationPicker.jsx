import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import { MapInvalidateSize } from "./MapInvalidateSize.jsx";
import { OsmTileLayer } from "./OsmTileLayer.jsx";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { UI_KIT } from "../../lib/appUiKit.js";
import { DEFAULT_MAP_ZOOM, hasDisplayableMapPin, hasValidCoords } from "../../lib/geo/constants.js";
import { formatLocationSummary } from "../../lib/geo/formatGeo.js";
import { MapViewSync } from "./MapViewSync.jsx";
import { OsmAttribution } from "./OsmAttribution.jsx";

import "leaflet/dist/leaflet.css";

const READONLY_COORD_INPUT_CLASS =
  "input-base mt-1 cursor-default read-only:bg-neutral-50/95 read-only:text-neutral-700 dark:read-only:bg-slate-900/60 dark:read-only:text-slate-300";

// eslint-disable-next-line no-underscore-dangle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapPinHandler({ lat, lng, onMove, onDragStart }) {
  const markerRef = useRef(null);
  const draggingRef = useRef(false);

  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (draggingRef.current || lat == null || lng == null) return;
    const marker = markerRef.current;
    if (!marker) return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;
    marker.setLatLng([lat, lng]);
  }, [lat, lng]);

  if (lat == null || lng == null) return null;

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      draggable
      eventHandlers={{
        dragstart() {
          draggingRef.current = true;
          onDragStart?.();
        },
        dragend(e) {
          draggingRef.current = false;
          const p = e.target.getLatLng();
          onMove(p.lat, p.lng);
        },
      }}
    />
  );
}

function LocationActionButtons({
  myLocationLoading,
  loading,
  communityLoading,
  centerOnLabel,
  onUseMyLocation,
  onUseCommunityCenter,
  setApplyDefaultZoom,
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-secondary min-h-11 flex-1 px-3 text-sm touch-manipulation sm:flex-none"
        disabled={myLocationLoading || loading}
        onClick={() => {
          setApplyDefaultZoom(true);
          onUseMyLocation();
        }}
      >
        {myLocationLoading ? "Locating…" : "Use my location"}
      </button>
      <button
        type="button"
        className="btn-secondary min-h-11 flex-1 px-3 text-sm touch-manipulation sm:flex-none"
        disabled={communityLoading || loading}
        onClick={() => {
          setApplyDefaultZoom(true);
          onUseCommunityCenter();
        }}
      >
        {communityLoading ? "Looking up…" : centerOnLabel}
      </button>
    </div>
  );
}

function MapPanel({
  center,
  defaultZoom,
  applyDefaultZoom,
  showPin,
  lat,
  lng,
  onPinMove,
  onPinDragStart,
  attributionControl = true,
}) {
  return (
    <div className="min-h-[240px] overflow-hidden rounded-lg border border-neutral-200/90 ring-1 ring-black/[0.04] dark:border-slate-600 md:min-h-[280px]">
      <MapContainer
        center={center}
        zoom={defaultZoom}
        scrollWheelZoom
        attributionControl={attributionControl}
        className="z-0 h-[240px] w-full md:h-[280px]"
      >
        <OsmTileLayer />
        <MapViewSync
          center={center}
          zoom={defaultZoom}
          preserveZoom={!applyDefaultZoom}
          applyZoom={applyDefaultZoom}
        />
        <MapInvalidateSize deps={[showPin]} />
        <MapPinHandler
          lat={showPin ? lat : null}
          lng={showPin ? lng : null}
          onMove={onPinMove}
          onDragStart={onPinDragStart}
        />
      </MapContainer>
    </div>
  );
}

function ReadonlyCoordFields({ lat, lng }) {
  const showCoords = hasValidCoords(lat, lng);
  const latDisplay = showCoords ? Number(lat).toFixed(6) : "";
  const lngDisplay = showCoords ? Number(lng).toFixed(6) : "";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-4">
      <div className="min-w-0">
        <label className="label-base" htmlFor="profile-pin-latitude">
          Latitude
        </label>
        <input
          id="profile-pin-latitude"
          name="profilePinLatitude"
          type="text"
          inputMode="decimal"
          className={READONLY_COORD_INPUT_CLASS}
          value={latDisplay}
          placeholder="—"
          readOnly
          aria-readonly="true"
          tabIndex={-1}
        />
      </div>
      <div className="min-w-0">
        <label className="label-base" htmlFor="profile-pin-longitude">
          Longitude
        </label>
        <input
          id="profile-pin-longitude"
          name="profilePinLongitude"
          type="text"
          inputMode="decimal"
          className={READONLY_COORD_INPUT_CLASS}
          value={lngDisplay}
          placeholder="—"
          readOnly
          aria-readonly="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

/**
 * Publish/edit listing location picker.
 */
export function ListingLocationPicker({
  lat,
  lng,
  cityLabel,
  mapCenter,
  hasPin,
  loading,
  error,
  searchQuery,
  searchResults,
  onSearchQueryChange,
  onRunSearch,
  onSelectSearchResult,
  onPinMove,
  onPinDragStart,
  onUseMyLocation,
  onUseCommunityCenter,
  myLocationLoading,
  communityLoading,
  headingId = "listing-location-heading",
  headingTitle = "Pickup / meet-up location",
  headingDescription = "Optional but helps buyers find you. Tap the map or search an address — saving still works if lookup fails.",
  centerOnLabel = "Use community center",
  /** Profile edit: address fields above are canonical — avoid repeating locality in pin line / search. */
  variant = "listing",
  suppressAddressDuplicate = false,
}) {
  const showPin = hasDisplayableMapPin(lat, lng);
  const center = showPin ? [lat, lng] : [mapCenter.lat, mapCenter.lng];
  const defaultZoom = showPin ? 15 : DEFAULT_MAP_ZOOM;
  const [applyDefaultZoom, setApplyDefaultZoom] = useState(false);
  const prevHasPinRef = useRef(showPin);
  const isProfileVariant = variant === "profile";
  const hideSearchByDefault = isProfileVariant && suppressAddressDuplicate;

  useEffect(() => {
    if (showPin && !prevHasPinRef.current) {
      setApplyDefaultZoom(true);
    }
    prevHasPinRef.current = showPin;
  }, [showPin]);

  useEffect(() => {
    if (!applyDefaultZoom) return undefined;
    const id = window.requestAnimationFrame(() => setApplyDefaultZoom(false));
    return () => window.cancelAnimationFrame(id);
  }, [applyDefaultZoom]);

  const a11y = formatLocationSummary(cityLabel, lat, lng);
  const pinLine =
    showPin && hasValidCoords(lat, lng) ? formatLocationSummary(cityLabel, lat, lng) : "";
  const showHeading = Boolean(headingTitle || headingDescription);
  const showSearchBlock = !hideSearchByDefault;
  const mapHintText = "Drag the pin or tap the map to adjust your meet-up spot.";

  const actionButtons = (
    <LocationActionButtons
      myLocationLoading={myLocationLoading}
      loading={loading}
      communityLoading={communityLoading}
      centerOnLabel={centerOnLabel}
      onUseMyLocation={onUseMyLocation}
      onUseCommunityCenter={onUseCommunityCenter}
      setApplyDefaultZoom={setApplyDefaultZoom}
    />
  );

  const mapPanel = (
    <MapPanel
      center={center}
      defaultZoom={defaultZoom}
      applyDefaultZoom={applyDefaultZoom}
      showPin={showPin}
      lat={lat}
      lng={lng}
      onPinMove={onPinMove}
      onPinDragStart={onPinDragStart}
      attributionControl={!isProfileVariant}
    />
  );

  const statusMessages = (
    <>
      {error ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${UI_KIT.stateWarning}`} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-xs text-text-secondary dark:text-slate-400">Updating location…</p> : null}
    </>
  );

  if (isProfileVariant) {
    return (
      <section
        className="space-y-3"
        aria-labelledby={showHeading ? headingId : undefined}
        aria-label={showHeading ? undefined : "Pin location"}
      >
        {showHeading ? (
          <div>
            <h3 id={headingId} className="text-sm font-semibold text-text-primary dark:text-slate-100">
              {headingTitle}
            </h3>
            {headingDescription ? (
              <p className="mt-0.5 text-xs text-text-secondary dark:text-slate-400">{headingDescription}</p>
            ) : null}
          </div>
        ) : null}

        <p className="sr-only">{a11y}</p>
        <OsmAttribution className="sr-only" />

        {statusMessages}
        {mapPanel}
        <ReadonlyCoordFields lat={lat} lng={lng} />
        {actionButtons}
      </section>
    );
  }

  return (
    <section
      className="space-y-3"
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : "Location map"}
    >
      {showHeading ? (
        <div>
          <h3 id={headingId} className="text-sm font-semibold text-text-primary dark:text-slate-100">
            {headingTitle}
          </h3>
          {headingDescription ? (
            <p className="mt-0.5 text-xs text-text-secondary dark:text-slate-400">{headingDescription}</p>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only">{a11y}</p>
      {pinLine ? (
        <p className="text-sm font-medium text-text-primary dark:text-slate-100">
          Pin: <span className="font-normal">{pinLine}</span>
        </p>
      ) : (
        <p className="text-sm text-text-secondary dark:text-slate-400">
          No pin set yet — map preview is centered on the Philippines. Tap the map, search, or use the buttons below.
        </p>
      )}

      {actionButtons}

      {showSearchBlock ? (
        <div className="space-y-1.5">
          <label htmlFor="listing-geo-search" className="text-xs font-medium text-text-secondary dark:text-slate-400">
            Search address
          </label>
          <div className="flex gap-2">
            <input
              id="listing-geo-search"
              type="search"
              className="input-base min-h-11 flex-1 text-sm"
              placeholder="Barangay, street, landmark…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRunSearch();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary min-h-11 shrink-0 px-4 text-sm touch-manipulation"
              disabled={loading || String(searchQuery || "").trim().length < 2}
              onClick={onRunSearch}
            >
              Search
            </button>
          </div>
          {searchResults.length > 0 ? (
            <ul
              className={`max-h-36 overflow-y-auto rounded-lg border border-neutral-200/90 dark:border-slate-600 ${UI_KIT.surfaceMuted} divide-y divide-neutral-200/70 dark:divide-slate-700`}
            >
              {searchResults.map((row, i) => (
                <li key={`${row.lat}-${row.lng}-${i}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm text-text-primary hover:bg-primary-soft/60 dark:text-slate-100 dark:hover:bg-slate-800 touch-manipulation"
                    onClick={() => {
                      setApplyDefaultZoom(true);
                      onSelectSearchResult(row);
                    }}
                  >
                    {row.cityLabel || row.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {statusMessages}
      {mapPanel}
      {showPin && hasValidCoords(lat, lng) ? (
        <p className="text-xs text-text-secondary dark:text-slate-400">{mapHintText}</p>
      ) : null}
      <OsmAttribution />
    </section>
  );
}
