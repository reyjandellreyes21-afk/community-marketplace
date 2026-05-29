import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Leaflet inside scrollable / late-layout panels needs invalidateSize after paint.
 */
export function MapInvalidateSize({ deps = [] }) {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* map may be unmounting */
      }
    };
    invalidate();
    const t1 = window.setTimeout(invalidate, 100);
    const t2 = window.setTimeout(invalidate, 400);
    window.addEventListener("resize", invalidate);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", invalidate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optional layout triggers
  }, [map, ...deps]);

  return null;
}
