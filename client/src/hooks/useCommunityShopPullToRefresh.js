import { useEffect } from "react";

const PTR_COOLDOWN_MS = 2500;
const PULL_THRESHOLD_PX = 72;
const TOP_TOUCH_MAX_Y = 140;

/**
 * Mobile community shop: pull down from the top edge to refetch listings (same intent as the Refresh control).
 * Pass the same `loadCommunityShopListings` reference from `useCallback` in `App` so listeners are not rebound every render.
 */
export function useCommunityShopPullToRefresh({
  enabled,
  listingsBusyRef,
  cooldownRef,
  loadCommunityShopListings,
}) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined" || !("ontouchstart" in window)) return undefined;

    let startY = 0;
    let startScroll = 0;
    let armed = false;

    const onTouchStart = (e) => {
      if (listingsBusyRef.current) return;
      if (window.scrollY > 6) return;
      const y = e.touches[0]?.clientY ?? 0;
      if (y > TOP_TOUCH_MAX_Y) return;
      startY = y;
      startScroll = window.scrollY;
      armed = true;
    };

    const onTouchEnd = (e) => {
      if (!armed) return;
      armed = false;
      if (listingsBusyRef.current) return;
      if (startScroll > 6 || window.scrollY > 6) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      if (dy < PULL_THRESHOLD_PX) return;
      const now = Date.now();
      if (now - cooldownRef.current < PTR_COOLDOWN_MS) return;
      cooldownRef.current = now;
      void loadCommunityShopListings({ preserveExistingRows: true });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, listingsBusyRef, cooldownRef, loadCommunityShopListings]);
}
