import { useCallback, useEffect, useState } from "react";
import { ListingLocationPicker } from "./ListingLocationPicker.jsx";
import { useListingLocationPicker } from "../../hooks/useListingLocationPicker.js";
import {
  buildCommunityGeocodeQuery,
  buildProfileGeocodeQuery,
  resolveProfileGeocodeParts,
} from "../../lib/geo/formatGeo.js";

/**
 * Wrapper for App.jsx listing upload — syncs pin to parent via onLocationChange.
 */
export function ListingLocationPickerSection({
  initialLat,
  initialLng,
  initialCityLabel,
  profileDraft,
  user,
  activeCommunity,
  onLocationChange,
}) {
  const picker = useListingLocationPicker({
    initialLat,
    initialLng,
    initialCityLabel,
  });
  const [myLoading, setMyLoading] = useState(false);
  const [communityLoading, setCommunityLoading] = useState(false);

  useEffect(() => {
    onLocationChange?.({
      lat: picker.lat,
      lng: picker.lng,
      cityLabel: picker.cityLabel,
    });
  }, [picker.lat, picker.lng, picker.cityLabel, onLocationChange]);

  const handleUseMyLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      picker.setError("Location is not available on this device.");
      return;
    }
    setMyLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await picker.setFromCoords(pos.coords.latitude, pos.coords.longitude);
        setMyLoading(false);
      },
      (err) => {
        picker.setError(err?.code === 1 ? "Location permission denied." : "Could not get your location.");
        setMyLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }, [picker]);

  const handleUseCommunityCenter = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const commQ = buildCommunityGeocodeQuery(activeCommunity);
      if (commQ) {
        const rows = await picker.geocodeQuery(commQ);
        if (rows.length) return;
      }
      const profileParts = resolveProfileGeocodeParts({ profileDraft, user });
      const profileQ = buildProfileGeocodeQuery(profileParts);
      if (profileQ) {
        const rows = await picker.geocodeQuery(profileQ);
        if (rows.length) return;
        const simpleQ = buildProfileGeocodeQuery({
          city: profileParts.city,
          province: profileParts.province,
        });
        if (simpleQ && simpleQ !== profileQ) {
          await picker.geocodeQuery(simpleQ);
        }
        return;
      }
      picker.setError("Set your community or profile address first.");
    } finally {
      setCommunityLoading(false);
    }
  }, [activeCommunity, profileDraft, user, picker]);

  return (
    <ListingLocationPicker
      lat={picker.lat}
      lng={picker.lng}
      cityLabel={picker.cityLabel}
      mapCenter={picker.mapCenter}
      hasPin={picker.hasPin}
      loading={picker.loading}
      error={picker.error}
      searchQuery={picker.searchQuery}
      searchResults={picker.searchResults}
      onSearchQueryChange={picker.setSearchQueryOnly}
      onRunSearch={() => picker.runSearch(picker.searchQuery)}
      onSelectSearchResult={(row) => {
        void picker.setFromCoords(row.lat, row.lng, { reverse: false });
        picker.applyResult(row);
      }}
      onPinMove={picker.onPinMove}
      onUseMyLocation={handleUseMyLocation}
      onUseCommunityCenter={handleUseCommunityCenter}
      myLocationLoading={myLoading}
      communityLoading={communityLoading}
    />
  );
}
