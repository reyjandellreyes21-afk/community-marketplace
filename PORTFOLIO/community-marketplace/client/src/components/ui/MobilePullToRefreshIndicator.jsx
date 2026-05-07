/**
 * Floating refresh glyph for mobile pull-to-refresh — shows while pulling past threshold
 * and spins while the async refresh runs.
 */
export function MobilePullToRefreshIndicator({
  pullProgress,
  pullDragPx = 0,
  pullDirection = "idle",
  isRefreshing,
  visible,
  topOffsetPx = null,
  isArmed = false,
}) {
  if (!visible) return null;

  const p = Math.min(1, Math.max(0, pullProgress));
  const opacity = isRefreshing
    ? 1
    : pullDirection === "up"
      ? Math.min(1, p * 0.65)
      : Math.min(1, p * 1.2);
  const followY = isRefreshing ? 0 : Math.max(0, Number(pullDragPx || 0));
  const directionSign = pullDirection === "up" ? -1 : 1;
  const rotate = isRefreshing ? undefined : directionSign * Math.max(0, Math.min(360, pullDragPx * 2.1));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isRefreshing}
      className="pointer-events-none fixed z-[65]"
      style={{
        left: "50%",
        top:
          typeof topOffsetPx === "number"
            ? `${Math.max(8, Math.round(topOffsetPx + 6))}px`
            : "max(0.5rem, calc(4.25rem + env(safe-area-inset-top, 0px) + 0.25rem))",
        opacity,
        transform: `translate3d(-50%, ${followY}px, 0)`,
      }}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200/85 bg-white/95 text-brand-primary shadow-md backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95 dark:text-brand-accent ${
          isRefreshing ? "motion-safe:animate-spin motion-reduce:animate-none" : ""
        }`}
        style={!isRefreshing && rotate != null ? { transform: `rotate(${rotate}deg)` } : undefined}
      >
        <svg
          className="h-6 w-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M12 4.25a7.75 7.75 0 1 0 7.5 9.75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M19.5 4.5v4.75h-4.75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="sr-only">
        {isRefreshing ? "Refreshing content" : isArmed ? "Release to refresh" : "Pull down to refresh"}
      </span>
    </div>
  );
}
