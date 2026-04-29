import { useSyncExternalStore } from "react";

/**
 * Subscribes to `window.matchMedia(query)` — safe for SSR (returns `getServerSnapshot` value during prerender).
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false),
    () => false,
  );
}
