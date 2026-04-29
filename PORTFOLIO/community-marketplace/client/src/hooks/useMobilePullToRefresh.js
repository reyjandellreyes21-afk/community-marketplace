import { useEffect, useRef, useState } from "react";

const DEFAULT_COOLDOWN_MS = 2500;
const DEFAULT_PULL_THRESHOLD_PX = 72;
const DEFAULT_TOP_TOUCH_MAX_Y = 140;
const TOP_SCROLL_EPSILON = 6;

function getScrollTop(targetElement) {
  if (targetElement && typeof targetElement.scrollTop === "number") return targetElement.scrollTop;
  if (typeof window !== "undefined") return window.scrollY || 0;
  return 0;
}

/**
 * Generic mobile pull-to-refresh handler for scroll containers.
 * Refresh only fires when gesture starts at the top and enough pull distance is reached.
 */
export function useMobilePullToRefresh({
  enabled,
  onRefresh,
  onError,
  isBusy = false,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  pullThresholdPx = DEFAULT_PULL_THRESHOLD_PX,
  topTouchMaxY = DEFAULT_TOP_TOUCH_MAX_Y,
  targetElementId = "main-content",
}) {
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const lockRef = useRef(false);
  const cooldownRef = useRef(0);
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined" || !("ontouchstart" in window)) return undefined;
    if (typeof onRefresh !== "function") return undefined;

    const target = document.getElementById(targetElementId) || window;
    let startY = 0;
    let startScroll = 0;
    let armed = false;

    const isAtTop = () => getScrollTop(target === window ? null : target) <= TOP_SCROLL_EPSILON;

    const onTouchStart = (e) => {
      if (lockRef.current || busyRef.current) return;
      if (!isAtTop()) return;
      const y = e.touches?.[0]?.clientY ?? 0;
      if (y > topTouchMaxY) return;
      startY = y;
      startScroll = getScrollTop(target === window ? null : target);
      armed = true;
    };

    const onTouchEnd = (e) => {
      if (!armed) return;
      armed = false;
      if (lockRef.current || busyRef.current) return;
      if (startScroll > TOP_SCROLL_EPSILON || !isAtTop()) return;
      const endY = e.changedTouches?.[0]?.clientY ?? startY;
      if (endY - startY < pullThresholdPx) return;
      const now = Date.now();
      if (now - cooldownRef.current < cooldownMs) return;
      cooldownRef.current = now;
      lockRef.current = true;
      setIsPullRefreshing(true);
      Promise.resolve(onRefresh())
        .catch((error) => {
          if (typeof onError === "function") onError(error);
        })
        .finally(() => {
          lockRef.current = false;
          setIsPullRefreshing(false);
        });
    };

    const onTouchCancel = () => {
      armed = false;
    };

    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, onRefresh, onError, cooldownMs, pullThresholdPx, topTouchMaxY, targetElementId]);

  return { isPullRefreshing };
}
