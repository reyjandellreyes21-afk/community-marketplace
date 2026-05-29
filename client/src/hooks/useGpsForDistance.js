import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser geolocation for card distance labels only — separate from Near me listing filter.
 */
export function useGpsForDistance() {
  const [active, setActive] = useState(false);
  const [coords, setCoords] = useState(null);
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
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(next);
          setLoading(false);
          resolve(next);
        },
        (err) => {
          if (!mountedRef.current) return;
          const code = err?.code;
          let msg = "Could not get your location.";
          if (code === 1) msg = "Location permission denied. Enable it in browser settings.";
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

  const enableGps = useCallback(async () => {
    setActive(true);
    if (coords) return coords;
    const got = await refresh();
    if (!got) setActive(false);
    return got;
  }, [coords, refresh]);

  const disableGps = useCallback(() => {
    setActive(false);
    setError("");
  }, []);

  return { active, coords, loading, error, enableGps, disableGps, refresh };
}
