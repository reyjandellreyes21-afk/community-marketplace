import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_COOLDOWN_MS = 2500;
const DEFAULT_PULL_THRESHOLD_PX = 56;
const DEFAULT_TOP_TOUCH_MAX_Y = 10000;
const TOP_SCROLL_EPSILON = 40;
const VERTICAL_INTENT_THRESHOLD_PX = 8;
const HORIZONTAL_INTENT_THRESHOLD_PX = 16;
const HORIZONTAL_INTENT_RATIO = 1.25;
const MAX_PULL_VISUAL_VIEWPORT_RATIO = 0.10;
const MAX_PULL_VISUAL_FALLBACK_PX = 180;

function getScrollTop(targetElement) {
  if (targetElement && typeof targetElement.scrollTop === "number") return targetElement.scrollTop;
  if (typeof window !== "undefined") return window.scrollY || 0;
  return 0;
}

export function useMobilePullToRefresh({
  enabled,
  onRefresh,
  onError,
  onPullStateChange,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  pullThresholdPx = DEFAULT_PULL_THRESHOLD_PX,
  topTouchMaxY = DEFAULT_TOP_TOUCH_MAX_Y,
  targetElementId = "main-content",
}) {
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDragPx, setPullDragPx] = useState(0);
  const [pullPhysicsPx, setPullPhysicsPx] = useState(0);
  const [debugState, setDebugState] = useState({
    mode: null,
    intent: "none",
    startedAtTop: false,
    dx: 0,
    dy: 0,
    armed: false,
    tracking: false,
    lastReason: "idle",
  });

  const lockRef = useRef(false);
  const cooldownRef = useRef(0);
  const prevDirectionRef = useRef(1);

  const onRefreshRef = useRef(onRefresh);
  const onErrorRef = useRef(onError);
  const onPullStateChangeRef = useRef(onPullStateChange);
  const pullThresholdRef = useRef(pullThresholdPx);
  const cooldownMsRef = useRef(cooldownMs);
  const topTouchMaxYRef = useRef(topTouchMaxY);

  const gestureRef = useRef({
    mode: null, // "touch" | "pointer"
    pointerId: null,
    tracking: false,
    intent: "none", // "none" | "vertical" | "horizontal"
    startedAtTop: false,
    armed: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    currentPull: 0,
    maxPull: 0,
  });

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onPullStateChangeRef.current = onPullStateChange;
  }, [onPullStateChange]);
  useEffect(() => {
    pullThresholdRef.current = pullThresholdPx;
  }, [pullThresholdPx]);
  useEffect(() => {
    cooldownMsRef.current = cooldownMs;
  }, [cooldownMs]);
  useEffect(() => {
    topTouchMaxYRef.current = topTouchMaxY;
  }, [topTouchMaxY]);

  const pullProgress = useMemo(
    () => Math.min(1, pullPhysicsPx / Math.max(1, pullThresholdPx)),
    [pullPhysicsPx, pullThresholdPx],
  );
  const isPullArmed = pullProgress >= 1;
  const pullDirection = pullPhysicsPx > 0 ? (prevDirectionRef.current < 0 ? "up" : "down") : "idle";

  useEffect(() => {
    if (!enabled) {
      setPullDragPx(0);
      setPullPhysicsPx(0);
      setDebugState((prev) => ({ ...prev, tracking: false, armed: false, lastReason: "disabled" }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;

    const scrollEl = document.getElementById(targetElementId);
    if (!scrollEl) return undefined;

    const setPullLock = (active) => {
      if (active) scrollEl.setAttribute("data-pull-intent", "vertical");
      else scrollEl.removeAttribute("data-pull-intent");
    };

    const reportPullState = () => {
      const s = gestureRef.current;
      try {
        onPullStateChangeRef.current?.({
          tracking: Boolean(s.tracking),
          armed: Boolean(s.armed),
          inProgress: Boolean(lockRef.current),
        });
      } catch {
        /* ignore callback failures */
      }
    };

    const maxVisualPullPx = () => {
      if (typeof window === "undefined") return MAX_PULL_VISUAL_FALLBACK_PX;
      return Math.max(72, Math.round(window.innerHeight * MAX_PULL_VISUAL_VIEWPORT_RATIO));
    };

    const computeVisualPullPx = (currentPull, maxPull) => {
      const cap = maxVisualPullPx();
      const current = Math.max(0, Number(currentPull || 0));
      const peak = Math.max(0, Number(maxPull || 0), current);
      return Math.max(0, Math.min(cap, Math.max(current, Math.min(peak, cap))));
    };

    const resetVisuals = () => {
      setPullDragPx(0);
      setPullPhysicsPx(0);
    };

    const resetGesture = (reason = "reset") => {
      gestureRef.current = {
        mode: null,
        pointerId: null,
        tracking: false,
        intent: "none",
        startedAtTop: false,
        armed: false,
        startX: 0,
        startY: 0,
        dx: 0,
        dy: 0,
        currentPull: 0,
        maxPull: 0,
      };
      setPullLock(false);
      reportPullState();
      setDebugState((prev) => ({
        ...prev,
        mode: null,
        intent: "none",
        startedAtTop: false,
        dx: 0,
        dy: 0,
        armed: false,
        tracking: false,
        lastReason: reason,
      }));
    };

    const beginGesture = (clientX, clientY, mode, pointerId = null) => {
      if (lockRef.current) return;
      const y = Number(clientY || 0);
      if (y <= 0 || y > topTouchMaxYRef.current) return;
      const startedAtTop = getScrollTop(scrollEl) <= TOP_SCROLL_EPSILON;
      gestureRef.current = {
        mode,
        pointerId,
        tracking: true,
        intent: "none",
        startedAtTop,
        armed: false,
        startX: Number(clientX || 0),
        startY: y,
        dx: 0,
        dy: 0,
        currentPull: 0,
        maxPull: 0,
      };
      resetVisuals();
      setPullLock(false);
      reportPullState();
      setDebugState((prev) => ({
        ...prev,
        mode,
        intent: "none",
        startedAtTop,
        dx: 0,
        dy: 0,
        armed: false,
        tracking: true,
        lastReason: "start",
      }));
    };

    const updateGesture = (eventLike, clientX, clientY) => {
      const s = gestureRef.current;
      if (!s.tracking || lockRef.current) return;

      s.dx = Number(clientX || 0) - s.startX;
      s.dy = Number(clientY || 0) - s.startY;
      const absDx = Math.abs(s.dx);
      const absDy = Math.abs(s.dy);
      prevDirectionRef.current = s.dy < 0 ? -1 : s.dy > 0 ? 1 : prevDirectionRef.current;

      if (s.intent === "none") {
        if (s.startedAtTop && s.dy > VERTICAL_INTENT_THRESHOLD_PX && absDy >= absDx * 0.85) {
          s.intent = "vertical";
          setPullLock(true);
        } else if (absDx > HORIZONTAL_INTENT_THRESHOLD_PX && absDx > absDy * HORIZONTAL_INTENT_RATIO) {
          s.intent = "horizontal";
          setPullLock(false);
        } else {
          return;
        }
      }

      if (s.intent !== "vertical") {
        resetVisuals();
        s.currentPull = 0;
        s.armed = false;
        reportPullState();
        setDebugState((prev) => ({
          ...prev,
          mode: s.mode,
          intent: s.intent,
          startedAtTop: s.startedAtTop,
          dx: s.dx,
          dy: s.dy,
          armed: false,
          tracking: true,
          lastReason: "horizontal-intent",
        }));
        return;
      }

      if (!s.startedAtTop || getScrollTop(scrollEl) > TOP_SCROLL_EPSILON * 2) {
        resetVisuals();
        s.currentPull = 0;
        s.armed = false;
        reportPullState();
        setDebugState((prev) => ({
          ...prev,
          mode: s.mode,
          intent: s.intent,
          startedAtTop: s.startedAtTop,
          dx: s.dx,
          dy: s.dy,
          armed: false,
          tracking: true,
          lastReason: "not-top",
        }));
        return;
      }

      if (s.dy > 0 && eventLike?.cancelable) {
        eventLike.preventDefault();
      }

      const nextPull = Math.max(0, s.dy);
      s.currentPull = nextPull;
      s.maxPull = Math.max(s.maxPull, nextPull);
      s.armed = nextPull >= pullThresholdRef.current;

      setPullPhysicsPx(nextPull);
      setPullDragPx(computeVisualPullPx(nextPull, s.maxPull));
      reportPullState();
      setDebugState((prev) => ({
        ...prev,
        mode: s.mode,
        intent: s.intent,
        startedAtTop: s.startedAtTop,
        dx: s.dx,
        dy: s.dy,
        armed: s.armed,
        tracking: true,
        lastReason: s.armed ? "drag-armed" : "drag",
      }));
    };

    const endGesture = () => {
      const s = { ...gestureRef.current };
      const shouldRefresh =
        s.tracking &&
        s.intent === "vertical" &&
        s.startedAtTop &&
        s.currentPull >= pullThresholdRef.current &&
        !lockRef.current;

      resetVisuals();
      resetGesture(shouldRefresh ? "release-refresh" : "release-no-refresh");
      if (!shouldRefresh) return;

      const now = Date.now();
      if (now - cooldownRef.current < cooldownMsRef.current) return;
      cooldownRef.current = now;

      lockRef.current = true;
      setIsPullRefreshing(true);
      reportPullState();
      Promise.resolve(onRefreshRef.current?.())
        .catch((error) => {
          if (typeof onErrorRef.current === "function") onErrorRef.current(error);
        })
        .finally(() => {
          lockRef.current = false;
          setIsPullRefreshing(false);
          reportPullState();
        });
    };

    const cancelGesture = () => {
      resetVisuals();
      resetGesture("cancel");
    };

    const onTouchStart = (e) => {
      if (gestureRef.current.mode && gestureRef.current.mode !== "touch") return;
      const t = e.touches?.[0];
      if (!t) return;
      beginGesture(t.clientX, t.clientY, "touch");
    };
    const onTouchMove = (e) => {
      if (gestureRef.current.mode !== "touch") return;
      const t = e.touches?.[0];
      if (!t) return;
      updateGesture(e, t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      if (gestureRef.current.mode !== "touch") return;
      endGesture();
    };
    const onTouchCancel = () => {
      if (gestureRef.current.mode !== "touch") return;
      cancelGesture();
    };

    const onPointerDown = (e) => {
      if (!("PointerEvent" in window)) return;
      if (gestureRef.current.mode && gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary) return;
      beginGesture(e.clientX, e.clientY, "pointer", e.pointerId);
    };
    const onPointerMove = (e) => {
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      updateGesture(e, e.clientX, e.clientY);
    };
    const onPointerUp = (e) => {
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      endGesture();
    };
    const onPointerCancel = (e) => {
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      cancelGesture();
    };

    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollEl.addEventListener("touchend", onTouchEnd, { passive: true });
    scrollEl.addEventListener("touchcancel", onTouchCancel, { passive: true });
    scrollEl.addEventListener("pointerdown", onPointerDown, { passive: true });
    scrollEl.addEventListener("pointermove", onPointerMove, { passive: false });
    scrollEl.addEventListener("pointerup", onPointerUp, { passive: true });
    scrollEl.addEventListener("pointercancel", onPointerCancel, { passive: true });

    return () => {
      setPullLock(false);
      scrollEl.removeEventListener("touchstart", onTouchStart);
      scrollEl.removeEventListener("touchmove", onTouchMove);
      scrollEl.removeEventListener("touchend", onTouchEnd);
      scrollEl.removeEventListener("touchcancel", onTouchCancel);
      scrollEl.removeEventListener("pointerdown", onPointerDown);
      scrollEl.removeEventListener("pointermove", onPointerMove);
      scrollEl.removeEventListener("pointerup", onPointerUp);
      scrollEl.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [enabled, targetElementId]);

  return { isPullRefreshing, pullDragPx, pullProgress, isPullArmed, pullDirection, debugState };
}
