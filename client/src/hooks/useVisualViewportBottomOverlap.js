import { useEffect, useState } from "react";

/**
 * Pixels of the layout viewport covered below the visual viewport (URL bar, virtual keyboard, etc.).
 * Drives padding so in-flow “footer” composers stay above the mobile keyboard when `visualViewport` updates.
 */
export function useVisualViewportBottomOverlap(enabled) {
  const [overlapPx, setOverlapPx] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setOverlapPx(0);
      return undefined;
    }
    const vv = window.visualViewport;
    if (!vv) {
      setOverlapPx(0);
      return undefined;
    }

    const update = () => {
      const innerH = window.innerHeight;
      const bottomGap = innerH - (vv.offsetTop + vv.height);
      const next = Math.max(0, Math.round(bottomGap));
      setOverlapPx((prev) => (prev === next ? prev : next));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      setOverlapPx(0);
    };
  }, [enabled]);

  return overlapPx;
}
