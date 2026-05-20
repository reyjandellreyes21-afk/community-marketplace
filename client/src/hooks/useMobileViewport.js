import { useContext } from "react";
import { ViewportContext } from "../context/ViewportContext.jsx";
import { mediaQueries } from "../utils/mobile/breakpoints.js";
import { useMediaQuery } from "./useMediaQuery.js";

/**
 * True when viewport matches the app’s “mobile shell” breakpoint (`max-width: 767px`).
 * Uses `ViewportProvider` when present (single subscription); otherwise falls back to a local `matchMedia` hook
 * (tests / isolated usage).
 */
export function useMobileViewport() {
  const ctx = useContext(ViewportContext);
  const isMobileFromMedia = useMediaQuery(mediaQueries.mobile);
  if (ctx != null) return ctx;
  return { isMobile: isMobileFromMedia, isMdUp: !isMobileFromMedia };
}
