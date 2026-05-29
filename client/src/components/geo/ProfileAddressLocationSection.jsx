import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoMapErrorBoundary } from "./GeoMapErrorBoundary.jsx";
import { ListingLocationPicker } from "./ListingLocationPicker.jsx";
import { useListingLocationPicker } from "../../hooks/useListingLocationPicker.js";
import { hasDisplayableMapPin } from "../../lib/geo/constants.js";
import { buildProfileGeocodeQuery, resolveProfileGeocodeParts } from "../../lib/geo/formatGeo.js";

const ADDRESS_GEOCODE_DEBOUNCE_MS = 300;

/**
 * Profile edit — map pin under address fields (saved with main profile form as defaultLat/defaultLng).
 */
export function ProfileAddressLocationSection({
  profileDraft,
  user,
  initialDefaultLat,
  initialDefaultLng,
  onLocationChange,
}) {
  const picker = useListingLocationPicker({
    initialLat: initialDefaultLat,
    initialLng: initialDefaultLng,
    initialCityLabel: "",
  });
  const [myLoading, setMyLoading] = useState(false);
  const hadSavedPinOnOpenRef = useRef(hasDisplayableMapPin(initialDefaultLat, initialDefaultLng));
  const initialAddressQueryRef = useRef("");

  useEffect(() => {
    onLocationChange?.({ lat: picker.lat, lng: picker.lng });
  }, [picker.lat, picker.lng, onLocationChange]);

  const suppressAddressDuplicate = useMemo(() => {
    const parts = resolveProfileGeocodeParts({ profileDraft, user });
    return Boolean(parts.province && parts.city);
  }, [
    profileDraft?.addressHouseStreet,
    profileDraft?.addressSubdivision,
    profileDraft?.addressBarangay,
    profileDraft?.addressCity,
    profileDraft?.addressProvince,
    profileDraft?.addressPostalCode,
    profileDraft?.community,
    user?.address,
    user?.community,
  ]);

  useEffect(() => {
    if (suppressAddressDuplicate) picker.clearSearchUi();
  }, [suppressAddressDuplicate, picker.clearSearchUi]);

  const geocodeFromProfileAddress = useCallback(
    async ({ showEmptyError = false, markUserPlaced = false } = {}) => {
      const parts = resolveProfileGeocodeParts({ profileDraft, user });
      const q = buildProfileGeocodeQuery(parts);
      if (!q) {
        if (showEmptyError) {
          picker.setError("Set your province and city above first.");
        }
        return false;
      }
      const geocodeOpts = { clearSearchAfter: true, markUserPlaced };
      const rows = await picker.geocodeQuery(q, geocodeOpts);
      if (rows.length) return true;
      const simpleQ = buildProfileGeocodeQuery({ city: parts.city, province: parts.province });
      if (simpleQ && simpleQ !== q) {
        const fallbackRows = await picker.geocodeQuery(simpleQ, geocodeOpts);
        return fallbackRows.length > 0;
      }
      return false;
    },
    [profileDraft, user, picker],
  );

  const handleUseProfileAddress = useCallback(() => {
    void geocodeFromProfileAddress({ showEmptyError: true, markUserPlaced: false });
  }, [geocodeFromProfileAddress]);

  const geocodeFromProfileRef = useRef(geocodeFromProfileAddress);
  geocodeFromProfileRef.current = geocodeFromProfileAddress;
  const clearPickerErrorRef = useRef(picker.setError);
  clearPickerErrorRef.current = picker.setError;
  const userAdjustedPinRef = useRef(picker.userAdjustedPin);
  userAdjustedPinRef.current = picker.userAdjustedPin;
  const lastAutoGeocodeQueryRef = useRef("");
  const autoGeocodeTimerRef = useRef(null);
  const isFirstAddressGeocodeRef = useRef(true);

  const cancelPendingAutoGeocode = useCallback(() => {
    if (autoGeocodeTimerRef.current) {
      window.clearTimeout(autoGeocodeTimerRef.current);
      autoGeocodeTimerRef.current = null;
    }
  }, []);

  const handlePinMove = useCallback(
    (nextLat, nextLng) => {
      cancelPendingAutoGeocode();
      picker.cancelPendingReverse();
      picker.onPinMove(nextLat, nextLng);
    },
    [cancelPendingAutoGeocode, picker],
  );

  const handlePinDragStart = useCallback(() => {
    cancelPendingAutoGeocode();
    picker.cancelPendingReverse();
  }, [cancelPendingAutoGeocode, picker]);

  /** Keep pin in sync with address fields until the user drags the pin or uses GPS. */
  useEffect(() => {
    if (picker.userAdjustedPin) return;

    const parts = resolveProfileGeocodeParts({ profileDraft, user });
    const q = buildProfileGeocodeQuery(parts);
    if (!q) return;
    if (!initialAddressQueryRef.current) initialAddressQueryRef.current = q;
    if (hadSavedPinOnOpenRef.current && q === initialAddressQueryRef.current) return;
    if (q === lastAutoGeocodeQueryRef.current && !isFirstAddressGeocodeRef.current) return;

    cancelPendingAutoGeocode();
    const delay = isFirstAddressGeocodeRef.current ? 0 : ADDRESS_GEOCODE_DEBOUNCE_MS;
    isFirstAddressGeocodeRef.current = false;

    autoGeocodeTimerRef.current = window.setTimeout(() => {
      autoGeocodeTimerRef.current = null;
      if (userAdjustedPinRef.current) return;
      lastAutoGeocodeQueryRef.current = q;
      void geocodeFromProfileRef.current({ markUserPlaced: false }).then((ok) => {
        if (!ok) {
          lastAutoGeocodeQueryRef.current = "";
          clearPickerErrorRef.current("");
        }
      });
    }, delay);

    return () => cancelPendingAutoGeocode();
  }, [
    cancelPendingAutoGeocode,
    picker.userAdjustedPin,
    profileDraft?.addressHouseStreet,
    profileDraft?.addressSubdivision,
    profileDraft?.addressBarangay,
    profileDraft?.addressCity,
    profileDraft?.addressProvince,
    profileDraft?.addressPostalCode,
    profileDraft?.community,
    user?.address,
    user?.community,
  ]);

  const handleUseMyLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      picker.setError("Location is not available on this device.");
      return;
    }
    cancelPendingAutoGeocode();
    setMyLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await picker.setFromCoords(pos.coords.latitude, pos.coords.longitude, { markUserPlaced: true });
        setMyLoading(false);
      },
      (err) => {
        picker.setError(err?.code === 1 ? "Location permission denied." : "Could not get your location.");
        setMyLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }, [cancelPendingAutoGeocode, picker]);

  const pickerProps = {
    lat: picker.lat,
    lng: picker.lng,
    cityLabel: picker.cityLabel,
    mapCenter: picker.mapCenter,
    hasPin: picker.hasPin,
    loading: picker.loading,
    error: picker.error,
    searchQuery: picker.searchQuery,
    searchResults: picker.searchResults,
    onSearchQueryChange: picker.setSearchQueryOnly,
    onRunSearch: () => picker.runSearch(picker.searchQuery),
    onSelectSearchResult: (row) => {
      void picker.setFromCoords(row.lat, row.lng, { reverse: false, markUserPlaced: true });
      picker.applyResult(row, { markUserPlaced: true });
      picker.clearSearchUi();
    },
    onPinMove: handlePinMove,
    onPinDragStart: handlePinDragStart,
    onUseMyLocation: handleUseMyLocation,
    onUseCommunityCenter: handleUseProfileAddress,
    myLocationLoading: myLoading,
    communityLoading: picker.loading,
    headingTitle: "Pin location",
    headingDescription:
      "Follows your address above. Drag the pin or use GPS below to set a custom spot.",
    centerOnLabel: "Center on my address",
    variant: "profile",
    suppressAddressDuplicate,
  };

  return (
    <GeoMapErrorBoundary>
      <ListingLocationPicker {...pickerProps} />
    </GeoMapErrorBoundary>
  );
}
