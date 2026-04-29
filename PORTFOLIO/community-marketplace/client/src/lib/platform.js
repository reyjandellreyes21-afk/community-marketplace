/**
 * Host/runtime detection for web, PWA standalone, and Capacitor WebView.
 * Keep native-specific bridges behind checks here instead of scattering `window` hacks.
 */

export function isCapacitorNative() {
  return typeof window !== "undefined" && Boolean(window.Capacitor?.isNativePlatform?.());
}

/** True when the app runs as an installed PWA (home screen). */
export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  return Boolean(window.navigator?.standalone);
}

export function appShellKind() {
  if (isCapacitorNative()) return "capacitor";
  if (isStandaloneDisplayMode()) return "standalone";
  return "browser";
}
