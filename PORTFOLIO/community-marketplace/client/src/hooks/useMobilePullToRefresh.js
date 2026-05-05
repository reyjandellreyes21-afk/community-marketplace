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
const GESTURE_STALE_TIMEOUT_MS = 1400;
const DEBUG_PTR_FORENSICS = false;

function getScrollTop(targetElement) {
  if (targetElement && typeof targetElement.scrollTop === "number") return targetElement.scrollTop;
  if (typeof window !== "undefined") return window.scrollY || 0;
  return 0;
}

/**
 * Deterministic mobile pull-to-refresh handler.
 * Single gesture state + intent lock:
 * - Starts only when gesture begins at top.
 * - Vertical intent locks pull flow.
 * - Refresh fires only if released while armed.
 */
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
  /** Smoothed vertical offset for the floating indicator only. */
  const [pullDragPx, setPullDragPx] = useState(0);
  /** Raw finger pull (px) for progress / armed UI so release threshold matches what the user feels. */
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
  const prevDyRef = useRef(0);
  const prevMoveDyRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const onErrorRef = useRef(onError);
  const onPullStateChangeRef = useRef(onPullStateChange);
  const pullThresholdRef = useRef(pullThresholdPx);
  const cooldownMsRef = useRef(cooldownMs);
  const topTouchMaxYRef = useRef(topTouchMaxY);
  const gestureRef = useRef({
    mode: null, // "touch" | "pointer"
    intent: "none", // "none" | "vertical" | "horizontal"
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    startedAtTop: false,
    armed: false,
    tracking: false,
    pointerId: null,
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
  const pullDirection = pullPhysicsPx > 0 ? (prevDyRef.current < 0 ? "up" : "down") : "idle";

  useEffect(() => {
    if (!enabled) {
      setPullDragPx(0);
      setPullPhysicsPx(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === "undefined") return undefined;

    const logGesture = (...args) => {
      if (!DEBUG_PTR_FORENSICS) return;
      console.debug("[pull-refresh]", ...args);
    };
    const emitDebugLog = (hypothesisId, location, message, data = {}) => {
      if (!DEBUG_PTR_FORENSICS) return;
      // #region agent log
      fetch("http://127.0.0.1:7713/ingest/ca4f9b27-c5d1-4802-b31e-0e9faf85a336", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "004537",
        },
        body: JSON.stringify({
          sessionId: "004537",
          runId: "pre-fix-1",
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const scrollEl = document.getElementById(targetElementId);
    if (!scrollEl) return undefined;

    const hasCoarseTouch = window.matchMedia?.("(pointer: coarse)")?.matches === true;
    const hasTouchPoints = Number(navigator?.maxTouchPoints || 0) > 0;
    const hasTouchEvents = "ontouchstart" in window;
    const prefersTouchPath = hasCoarseTouch || hasTouchPoints || hasTouchEvents;
    const useTouchPath = prefersTouchPath;
    const usePointerPath = !prefersTouchPath && "PointerEvent" in window;
    logGesture("input-policy", { hasCoarseTouch, hasTouchPoints, hasTouchEvents, useTouchPath, usePointerPath });
    emitDebugLog("H2", "useMobilePullToRefresh.js:122", "Input path policy selected", {
      hasCoarseTouch,
      hasTouchPoints,
      hasTouchEvents,
      useTouchPath,
      usePointerPath,
    });

    let staleTimerId = 0;
    const clearStaleTimer = () => {
      if (!staleTimerId) return;
      window.clearTimeout(staleTimerId);
      staleTimerId = 0;
    };
    const armStaleTimer = () => {
      clearStaleTimer();
      staleTimerId = window.setTimeout(() => {
        const s = gestureRef.current;
        if (!s.tracking) return;
        logGesture("stale-timeout-reset", { mode: s.mode, intent: s.intent, dx: s.dx, dy: s.dy });
        emitDebugLog("H5", "useMobilePullToRefresh.js:135", "Gesture reset by stale timeout", {
          mode: s.mode,
          intent: s.intent,
          dx: s.dx,
          dy: s.dy,
        });
        cancelGesture();
      }, GESTURE_STALE_TIMEOUT_MS);
    };

    const setPullLock = (active) => {
      if (active) scrollEl.setAttribute("data-pull-intent", "vertical");
      else scrollEl.removeAttribute("data-pull-intent");
    };
    const reportPullState = (overrides = {}) => {
      const state = gestureRef.current;
      const payload = {
        tracking: Boolean(state.tracking),
        armed: Boolean(state.armed),
        inProgress: Boolean(lockRef.current),
        ...overrides,
      };
      try {
        onPullStateChangeRef.current?.(payload);
      } catch {
        /* ignore callback errors */
      }
    };
    const updateDebugState = (patch = {}) => {
      if (!DEBUG_PTR_FORENSICS) return;
      setDebugState((prev) => ({ ...prev, ...patch }));
    };

    const resetPullVisualsToZero = () => {
      setPullDragPx(0);
      setPullPhysicsPx(0);
    };
    const getMaxVisualPullPx = () => {
      if (typeof window === "undefined") return MAX_PULL_VISUAL_FALLBACK_PX;
      return Math.max(72, Math.round(window.innerHeight * MAX_PULL_VISUAL_VIEWPORT_RATIO));
    };
    const computeVisualPullPx = (currentPull, maxPull) => {
      const cap = getMaxVisualPullPx();
      const current = Math.max(0, Number(currentPull || 0));
      const peak = Math.max(0, Number(maxPull || 0), current);
      // Keep the cap, but decay immediately from the peak as the finger moves upward.
      const overshoot = Math.max(0, peak - cap);
      return Math.max(0, Math.min(cap, current - overshoot));
    };

    const resetGestureState = () => {
      gestureRef.current = {
        mode: null,
        intent: "none",
        startX: 0,
        startY: 0,
        dx: 0,
        dy: 0,
        startedAtTop: false,
        armed: false,
        tracking: false,
        pointerId: null,
        currentPull: 0,
        maxPull: 0,
      };
      setPullLock(false);
      reportPullState({ tracking: false, armed: false });
      updateDebugState({
        mode: null,
        intent: "none",
        startedAtTop: false,
        dx: 0,
        dy: 0,
        armed: false,
        tracking: false,
      });
      clearStaleTimer();
      prevDyRef.current = 0;
      prevMoveDyRef.current = 0;
    };

    const beginGesture = (clientX, clientY, mode) => {
      if (lockRef.current) return;
      const y = Number(clientY || 0);
      if (y <= 0 || y > topTouchMaxYRef.current) return;
      resetPullVisualsToZero();
      const startedAtTop = getScrollTop(scrollEl) <= TOP_SCROLL_EPSILON;
      gestureRef.current = {
        mode,
        intent: "none",
        startX: Number(clientX || 0),
        startY: y,
        dx: 0,
        dy: 0,
        startedAtTop,
        armed: false,
        tracking: true,
        pointerId: mode === "pointer" ? gestureRef.current.pointerId : null,
        currentPull: 0,
        maxPull: 0,
      };
      setPullLock(false);
      reportPullState({ tracking: true, armed: false });
      armStaleTimer();
      prevDyRef.current = 0;
      prevMoveDyRef.current = 0;
      updateDebugState({
        mode,
        intent: "none",
        startedAtTop,
        dx: 0,
        dy: 0,
        armed: false,
        tracking: true,
        lastReason: "start",
      });
      logGesture("start", { mode, startedAtTop, y });
      emitDebugLog("H3", "useMobilePullToRefresh.js:230", "Gesture started", {
        mode,
        startedAtTop,
        y,
        scrollTop: getScrollTop(scrollEl),
      });
    };

    const updateGesture = (eventLike, clientX, clientY) => {
      const state = gestureRef.current;
      if (!state.tracking || lockRef.current) return;
      armStaleTimer();
      state.dx = Number(clientX || 0) - state.startX;
      state.dy = Number(clientY || 0) - state.startY;
      prevDyRef.current =
        state.dy < prevMoveDyRef.current ? -1 : state.dy > prevMoveDyRef.current ? 1 : prevDyRef.current;
      prevMoveDyRef.current = state.dy;
      const absDx = Math.abs(state.dx);
      const absDy = Math.abs(state.dy);
      const hasActivePull = state.currentPull > 0 || state.maxPull > 0;

      if (state.intent === "none") {
        if (state.startedAtTop && state.dy > VERTICAL_INTENT_THRESHOLD_PX && absDy >= absDx * 0.8) {
          state.intent = "vertical";
          setPullLock(true);
          reportPullState({ tracking: true, armed: false });
          updateDebugState({ intent: "vertical", lastReason: "intent-vertical" });
          logGesture("intent", { intent: state.intent, dx: state.dx, dy: state.dy, startedAtTop: state.startedAtTop });
          emitDebugLog("H4", "useMobilePullToRefresh.js:248", "Intent locked vertical", {
            dx: state.dx,
            dy: state.dy,
            startedAtTop: state.startedAtTop,
          });
        } else if (!hasActivePull && absDx > HORIZONTAL_INTENT_THRESHOLD_PX && absDx > absDy * HORIZONTAL_INTENT_RATIO) {
          state.intent = "horizontal";
          setPullLock(false);
          updateDebugState({ intent: "horizontal", lastReason: "intent-horizontal" });
          logGesture("intent", { intent: state.intent, dx: state.dx, dy: state.dy, startedAtTop: state.startedAtTop });
          emitDebugLog("H4", "useMobilePullToRefresh.js:254", "Intent locked horizontal", {
            dx: state.dx,
            dy: state.dy,
            startedAtTop: state.startedAtTop,
          });
        } else {
          return;
        }
      }

      if (state.intent !== "vertical" && hasActivePull && state.startedAtTop) {
        const nextPull = Math.max(0, state.dy);
        state.currentPull = nextPull;
        state.maxPull = Math.max(state.maxPull, nextPull);
        state.armed = false;
        setPullPhysicsPx(nextPull);
        const nextVisualPull = computeVisualPullPx(nextPull, state.maxPull);
        setPullDragPx(nextVisualPull);
        logGesture("drag-visual-decay", {
          dx: state.dx,
          dy: state.dy,
          currentPull: nextPull,
          maxPull: state.maxPull,
          visualPull: nextVisualPull,
        });
        reportPullState({ tracking: true, armed: false });
        updateDebugState({
          mode: state.mode,
          intent: state.intent,
          startedAtTop: state.startedAtTop,
          dx: state.dx,
          dy: state.dy,
          armed: false,
          tracking: true,
          lastReason: nextPull > 0 ? "drag-visual-decay" : "drag-up",
        });
        if (nextPull <= 0) state.maxPull = 0;
        return;
      }

      if (
        state.intent === "vertical" &&
        state.startedAtTop &&
        (state.dy > 0 || state.currentPull > 0)
      ) {
        if (eventLike?.cancelable) eventLike.preventDefault();
        try {
          if (scrollEl.scrollTop > 0) scrollEl.scrollTop = 0;
        } catch {
          /* ignore */
        }
      }

      if (state.intent !== "vertical") return;
      if (!state.startedAtTop) {
        resetPullVisualsToZero();
        state.currentPull = 0;
        state.armed = false;
        reportPullState({ tracking: true, armed: false });
        updateDebugState({
          mode: state.mode,
          intent: state.intent,
          startedAtTop: state.startedAtTop,
          dx: state.dx,
          dy: state.dy,
          armed: false,
          tracking: true,
          lastReason: "drag-not-at-top",
        });
        return;
      }
      const scrollTop = getScrollTop(scrollEl);
      if (scrollTop > TOP_SCROLL_EPSILON * 2) {
        resetPullVisualsToZero();
        state.currentPull = 0;
        state.armed = false;
        reportPullState({ tracking: true, armed: false });
        updateDebugState({
          mode: state.mode,
          intent: state.intent,
          startedAtTop: state.startedAtTop,
          dx: state.dx,
          dy: state.dy,
          armed: false,
          tracking: true,
          lastReason: "drag-left-top",
        });
        return;
      }
      if (state.dy <= 0) {
        state.currentPull = 0;
        state.maxPull = 0;
        state.armed = false;
        resetPullVisualsToZero();
        reportPullState({ tracking: true, armed: false });
        updateDebugState({
          mode: state.mode,
          intent: state.intent,
          startedAtTop: state.startedAtTop,
          dx: state.dx,
          dy: state.dy,
          armed: false,
          tracking: true,
          lastReason: "drag-up",
        });
        logGesture("drag", { dx: state.dx, dy: state.dy, armed: state.armed, atTop: scrollTop <= TOP_SCROLL_EPSILON });
        return;
      }
      state.currentPull = state.dy;
      state.maxPull = Math.max(state.maxPull, state.currentPull);
      const threshold = pullThresholdRef.current;
      state.armed = state.currentPull >= threshold;
      setPullPhysicsPx(state.currentPull);
      const nextVisualPull = computeVisualPullPx(state.currentPull, state.maxPull);
      setPullDragPx(nextVisualPull);
      reportPullState({ tracking: true, armed: state.armed });
      updateDebugState({
        mode: state.mode,
        intent: state.intent,
        startedAtTop: state.startedAtTop,
        dx: state.dx,
        dy: state.dy,
        armed: state.armed,
        tracking: true,
        lastReason: state.armed ? "drag-armed" : "drag",
      });
      logGesture("drag", {
        dx: state.dx,
        dy: state.dy,
        currentPull: state.currentPull,
        maxPull: state.maxPull,
        visualPull: nextVisualPull,
        armedNow: state.armed,
        atTop: scrollTop <= TOP_SCROLL_EPSILON,
      });
    };

    const endGesture = () => {
      clearStaleTimer();
      const state = gestureRef.current;
      const visualAtRelease = computeVisualPullPx(state.currentPull, state.maxPull);
      const visibleAtRelease = visualAtRelease > 0;
      const armedAtRelease = state.currentPull >= pullThresholdRef.current;
      const shouldRefresh =
        state.tracking &&
        state.intent === "vertical" &&
        state.startedAtTop &&
        armedAtRelease &&
        visibleAtRelease;
      const reason = !state.tracking
        ? "not-tracking"
        : state.intent !== "vertical"
          ? "non-vertical-intent"
          : !state.startedAtTop
            ? "not-started-top"
            : !armedAtRelease
              ? "not-armed"
              : !visibleAtRelease
                ? "icon-hidden-at-release"
                : "ok";
      resetPullVisualsToZero();
      resetGestureState();
      if (!shouldRefresh || lockRef.current) {
        updateDebugState({ lastReason: reason, tracking: false, armed: false });
        logGesture("end", {
          committed: false,
          reason,
          currentPullAtRelease: state.currentPull,
          maxPullDuringGesture: state.maxPull,
          visualAtRelease,
          visibleAtRelease,
          armedAtRelease,
        });
        emitDebugLog("H5", "useMobilePullToRefresh.js:327", "Refresh rejected", {
          reason,
          shouldRefresh,
          lockActive: lockRef.current,
          currentPullAtRelease: state.currentPull,
          maxPullDuringGesture: state.maxPull,
          visualAtRelease,
          visibleAtRelease,
          armedAtRelease,
        });
        return;
      }
      const now = Date.now();
      if (now - cooldownRef.current < cooldownMsRef.current) {
        updateDebugState({ lastReason: "cooldown", tracking: false, armed: false });
        logGesture("end", { committed: false, reason: "cooldown" });
        return;
      }
      cooldownRef.current = now;
      lockRef.current = true;
      setIsPullRefreshing(true);
      reportPullState({ tracking: false, armed: false, inProgress: true });
      updateDebugState({ lastReason: "refresh-trigger", tracking: false, armed: true });
      logGesture("end", {
        committed: true,
        reason: "refresh-trigger",
        currentPullAtRelease: state.currentPull,
        maxPullDuringGesture: state.maxPull,
        visualAtRelease,
        visibleAtRelease,
        armedAtRelease,
      });
      emitDebugLog("H5", "useMobilePullToRefresh.js:342", "Refresh triggered", {
        currentPullAtRelease: state.currentPull,
        maxPull: state.maxPull,
        threshold: pullThresholdRef.current,
        visualAtRelease,
        visibleAtRelease,
        armedAtRelease,
      });
      Promise.resolve(onRefreshRef.current?.())
        .catch((error) => {
          if (typeof onErrorRef.current === "function") onErrorRef.current(error);
        })
        .finally(() => {
          lockRef.current = false;
          setIsPullRefreshing(false);
          reportPullState({ tracking: false, armed: false, inProgress: false });
          try {
            const top = getScrollTop(scrollEl);
            if (top > 0 && top <= TOP_SCROLL_EPSILON * 3) {
              scrollEl.scrollTop = 0;
            }
          } catch {
            /* ignore */
          }
        });
    };

    const cancelGesture = () => {
      clearStaleTimer();
      resetPullVisualsToZero();
      resetGestureState();
      updateDebugState({ lastReason: "cancel" });
      logGesture("end", { committed: false, reason: "cancel" });
    };

    const onTouchStart = (e) => {
      if (!useTouchPath) return;
      if (gestureRef.current.mode && gestureRef.current.mode !== "touch") return;
      const t = e.touches?.[0];
      if (!t) return;
      logGesture("event-touchstart", { y: t.clientY, scrollTop: getScrollTop(scrollEl) });
      emitDebugLog("H1", "useMobilePullToRefresh.js:403", "touchstart received", {
        y: t.clientY,
        scrollTop: getScrollTop(scrollEl),
        useTouchPath,
      });
      beginGesture(t.clientX, t.clientY, "touch");
    };
    const onTouchMove = (e) => {
      if (!useTouchPath) return;
      if (gestureRef.current.mode !== "touch") return;
      const t = e.touches?.[0];
      if (!t) return;
      logGesture("event-touchmove", { y: t.clientY, scrollTop: getScrollTop(scrollEl) });
      updateGesture(e, t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      if (!useTouchPath) return;
      if (gestureRef.current.mode !== "touch") return;
      logGesture("event-touchend", { scrollTop: getScrollTop(scrollEl) });
      endGesture();
    };
    const onTouchCancel = () => {
      if (!useTouchPath) return;
      if (gestureRef.current.mode !== "touch") return;
      logGesture("event-touchcancel");
      cancelGesture();
    };

    const onPointerDown = (e) => {
      if (!usePointerPath) return;
      if (gestureRef.current.mode && gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary) return;
      gestureRef.current.pointerId = e.pointerId;
      logGesture("event-pointerdown", { pointerType: e.pointerType, y: e.clientY, scrollTop: getScrollTop(scrollEl) });
      emitDebugLog("H2", "useMobilePullToRefresh.js:433", "pointerdown received", {
        pointerType: e.pointerType,
        y: e.clientY,
        scrollTop: getScrollTop(scrollEl),
        usePointerPath,
      });
      beginGesture(e.clientX, e.clientY, "pointer");
      gestureRef.current.pointerId = e.pointerId;
    };
    const onPointerMove = (e) => {
      if (!usePointerPath) return;
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      logGesture("event-pointermove", { pointerType: e.pointerType, y: e.clientY, scrollTop: getScrollTop(scrollEl) });
      updateGesture(e, e.clientX, e.clientY);
    };
    const onPointerUp = (e) => {
      if (!usePointerPath) return;
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      logGesture("event-pointerup", { pointerType: e.pointerType, y: e.clientY, scrollTop: getScrollTop(scrollEl) });
      endGesture();
    };
    const onPointerCancel = (e) => {
      if (!usePointerPath) return;
      if (gestureRef.current.mode !== "pointer") return;
      if (!e.isPrimary || gestureRef.current.pointerId !== e.pointerId) return;
      logGesture("event-pointercancel", { pointerType: e.pointerType });
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
      clearStaleTimer();
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
