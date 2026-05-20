import { useEffect } from "react";

/** Locks `document` scrolling — used for full-screen mobile overlays (e.g. chat thread). */
export function useBodyScrollLock(enabled) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [enabled]);
}
