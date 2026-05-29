import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MAP_CENTER, hasDisplayableMapPin, hasValidCoords } from "../lib/geo/constants.js";
import { GEO_NO_RESULTS_MESSAGE, pickPhilippinesGeoResult } from "../lib/geo/formatGeo.js";
import { reverseGeo, searchGeo } from "../lib/geo/geoApi.js";

/**
 * Listing publish/edit map pin state (best-effort geocode; never blocks save).
 */
export function useListingLocationPicker({ initialLat, initialLng, initialCityLabel } = {}) {
  const [lat, setLat] = useState(() =>
    hasValidCoords(initialLat, initialLng) ? Number(initialLat) : null,
  );
  const [lng, setLng] = useState(() =>
    hasValidCoords(initialLat, initialLng) ? Number(initialLng) : null,
  );
  const [cityLabel, setCityLabel] = useState(() => String(initialCityLabel || "").trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const reverseTimerRef = useRef(null);
  /** After manual drag/tap/GPS, do not reset lat/lng from parent or address auto-geocode. */
  const userPlacedPinRef = useRef(false);
  const [userAdjustedPin, setUserAdjustedPin] = useState(false);

  const lockPinFromUser = useCallback(() => {
    userPlacedPinRef.current = true;
    setUserAdjustedPin(true);
  }, []);

  useEffect(() => {
    if (userPlacedPinRef.current) {
      setCityLabel(String(initialCityLabel || "").trim());
      return;
    }
    if (hasValidCoords(initialLat, initialLng)) {
      setLat(Number(initialLat));
      setLng(Number(initialLng));
    }
    setCityLabel(String(initialCityLabel || "").trim());
  }, [initialLat, initialLng, initialCityLabel]);

  const applyResult = useCallback(
    (row, { markUserPlaced = true } = {}) => {
      if (!row) return;
      if (markUserPlaced) lockPinFromUser();
      setLat(Number(row.lat));
      setLng(Number(row.lng));
      setCityLabel(String(row.cityLabel || row.displayName || "").trim().slice(0, 200));
      setError("");
    },
    [lockPinFromUser],
  );

  const setFromCoords = useCallback(
    async (nextLat, nextLng, { reverse = true, markUserPlaced = true } = {}) => {
      if (!hasValidCoords(nextLat, nextLng)) return;
      if (markUserPlaced) lockPinFromUser();
      setLat(Number(nextLat));
      setLng(Number(nextLng));
      if (!reverse) return;
      setLoading(true);
      setError("");
      try {
        const row = await reverseGeo(nextLat, nextLng);
        if (row) {
          setCityLabel(String(row.cityLabel || row.displayName || "").trim().slice(0, 200));
          setError("");
        }
      } catch (e) {
        setError(e?.message || "Could not look up address for this pin.");
      } finally {
        setLoading(false);
      }
    },
    [lockPinFromUser],
  );

  const runSearch = useCallback(async (q) => {
    const query = String(q || "").trim();
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const rows = await searchGeo(query, { limit: 5 });
      setSearchResults(rows);
      if (rows.length === 0) {
        setError(GEO_NO_RESULTS_MESSAGE);
      }
      return rows;
    } catch (e) {
      setError(e?.message || "Address search failed.");
      setSearchResults([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearchUi = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const geocodeQuery = useCallback(
    async (q, { clearSearchAfter = false, markUserPlaced = true } = {}) => {
      const rows = await runSearch(q);
      const hit = pickPhilippinesGeoResult(rows);
      if (hit) {
        await setFromCoords(hit.lat, hit.lng, { reverse: false, markUserPlaced });
        applyResult(hit, { markUserPlaced });
        if (clearSearchAfter) clearSearchUi();
      } else if (rows.length > 0 || String(q || "").trim()) {
        setError(GEO_NO_RESULTS_MESSAGE);
      }
      return rows;
    },
    [runSearch, setFromCoords, applyResult, clearSearchUi],
  );

  const scheduleReverseFromPin = useCallback(
    (nextLat, nextLng) => {
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      reverseTimerRef.current = setTimeout(() => {
        reverseTimerRef.current = null;
        void setFromCoords(nextLat, nextLng, { reverse: true });
      }, 450);
    },
    [setFromCoords],
  );

  const onPinMove = useCallback(
    (nextLat, nextLng) => {
      lockPinFromUser();
      setLat(nextLat);
      setLng(nextLng);
      scheduleReverseFromPin(nextLat, nextLng);
    },
    [lockPinFromUser, scheduleReverseFromPin],
  );

  const cancelPendingReverse = useCallback(() => {
    if (reverseTimerRef.current) {
      clearTimeout(reverseTimerRef.current);
      reverseTimerRef.current = null;
    }
  }, []);

  const mapCenter = hasDisplayableMapPin(lat, lng) ? { lat: Number(lat), lng: Number(lng) } : DEFAULT_MAP_CENTER;

  const setSearchQueryOnly = useCallback((v) => {
    const next = String(v || "");
    setSearchQuery(next);
    if (next.trim().length < 2) setSearchResults([]);
  }, []);

  return {
    lat,
    lng,
    cityLabel,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQueryOnly,
    searchResults,
    mapCenter,
    hasPin: hasValidCoords(lat, lng),
    setFromCoords,
    geocodeQuery,
    runSearch,
    onPinMove,
    applyResult,
    cancelPendingReverse,
    clearSearchUi,
    userAdjustedPin,
    clearPin: () => {
      userPlacedPinRef.current = false;
      setUserAdjustedPin(false);
      setLat(null);
      setLng(null);
      setCityLabel("");
      setSearchQuery("");
      setSearchResults([]);
    },
  };
}
