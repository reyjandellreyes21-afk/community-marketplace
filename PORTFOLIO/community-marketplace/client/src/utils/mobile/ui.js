/**
 * Mobile-first primitives — aligns with `:root` tokens in `index.css` (`--ui-touch-target`, `--ui-radius`, etc.).
 * Use with `cn()` inside mobile screens; unprefixed Tailwind here is the phone baseline; add `md:` only when
 * enhancing for larger viewports.
 */
export const MOBILE_UI = {
  /** Minimum tap height (Apple HIG / Material guidance). */
  touchMinH: "min-h-[var(--ui-touch-target)]",
  /** Square control / icon button footprint. */
  touchSquare: "h-[var(--ui-touch-target)] w-[var(--ui-touch-target)] shrink-0",
  touchManip: "touch-manipulation",
  radius: "rounded-[var(--ui-radius)]",
  radiusLg: "rounded-[var(--ui-radius-lg)]",
  radiusFull: "rounded-[var(--ui-radius-full)]",
  /** Matches `.app-shell-content-inset` / `.app-container` horizontal rhythm. */
  insetX: "px-[clamp(0.625rem,3.2vw,0.875rem)]",
  stackGap: "gap-4",
  sectionStack: "space-y-4",
  /** Body copy on controls and dense screens — use `md:text-sm` when tightening from tablet up. */
  textBody: "text-base leading-snug",
  textLabel: "text-sm font-medium leading-snug text-neutral-700 dark:text-slate-300",
  textTitle: "text-lg font-semibold leading-snug tracking-tight text-text-primary dark:text-slate-100",
  /** Full-width screen states inside the mobile shell — vertical rhythm for loading / empty / error / success. */
  screenStateMin: "min-h-[min(42dvh,16rem)]",
};
