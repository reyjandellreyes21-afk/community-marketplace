import { useCallback, useEffect, useRef, useState } from "react";
import { NEAR_ME_RADIUS_KM } from "../lib/geo/constants.js";

const STORAGE_KEY = "linkmart_near_me_v1";

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))) {
      return { lat: Number(p.lat), lng: Number(p.lng) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStored(coords) {
  try {
    if (coords) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Browser geolocation for “Near me” listing browse.
 */
export function useNearMeLocation() {
  const [enabled, setEnabled] = useState(false);
  const [coords, setCoords] = useState(() => readStored());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return Promise.resolve(null);
    }
    setLoading(true);
    setError("");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mountedRef.current) return;
          const next = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setCoords(next);
          writeStored(next);
          setLoading(false);
          resolve(next);
        },
        (err) => {
          if (!mountedRef.current) return;
          const code = err?.code;
          let msg = "Could not get your location.";
          if (code === 1) msg = "Location permission denied. Enable it in browser settings to use Near me.";
          else if (code === 2) msg = "Location unavailable. Try again outdoors or check device settings.";
          else if (code === 3) msg = "Location request timed out. Try again.";
          setError(msg);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
      );
    });
  }, []);

  const enableNearMe = useCallback(
    async (fallbackCoords = null) => {
      setEnabled(true);
      if (coords) return coords;
      const got = await refresh();
      if (got) return got;
      const la = Number(fallbackCoords?.lat);
      const ln = Number(fallbackCoords?.lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        const next = { lat: la, lng: ln };
        setCoords(next);
        writeStored(next);
        setError("");
        return next;
      }
      return null;
    },
    [coords, refresh],
  );

  const disableNearMe = useCallback(() => {
    setEnabled(false);
    setError("");
  }, []);

  const clearCoords = useCallback(() => {
    setCoords(null);
    writeStored(null);
  }, []);

  return {
    enabled,
    coords,
    loading,
    error,
    radiusKm: NEAR_ME_RADIUS_KM,
    enableNearMe,
    disableNearMe,
    refresh,
    clearCoords,
    setEnabled,
  };
}
