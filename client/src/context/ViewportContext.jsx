import { createContext, useMemo } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { mediaQueries } from "../utils/mobile/breakpoints.js";

/**
 * Mobile shell state strategy for this app:
 *
 * - **Primary:** colocated `useState` / `useReducer` (see `App.jsx` until features are extracted).
 * - **Context:** narrow providers for read-mostly cross-cutting UI signals — this file owns one shared
 *   `matchMedia('(max-width: 767px)')` subscription for `useMobileViewport()`.
 * - **Session / API:** `lib/appSession.js`, Supabase, `lib/appApi.js` — not mirrored in a client global store.
 * - **Zustand:** only if writable client state is shared across many distant surfaces and Context becomes noisy.
 * - **Redux Toolkit:** only at exceptional scale — not used here.
 */
export const ViewportContext = createContext(null);

/** Root provider: keeps a single viewport subscription for the whole tree. */
export function ViewportProvider({ children }) {
  const isMobile = useMediaQuery(mediaQueries.mobile);
  const value = useMemo(() => ({ isMobile, isMdUp: !isMobile }), [isMobile]);
  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}
