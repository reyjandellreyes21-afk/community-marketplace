import { ACTIVITY_TABS } from "../views.js";

/** Shared layout shells — neutral; accent tint is unified below. */
const SHARED_SHELL = {
  shellMobile:
    "border-t border-neutral-200/60 bg-neutral-50 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-slate-700/60 dark:bg-slate-950 dark:shadow-[0_1px_0_rgba(0,0,0,0.2)]",
  shellDesktop:
    "border-b border-neutral-200/60 bg-neutral-50 dark:border-slate-700/60 dark:bg-slate-950",
  childStripHeaderBand:
    "w-full shrink-0 border-t border-neutral-200/60 bg-neutral-50 shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:border-slate-700/60 dark:bg-slate-950 dark:shadow-[0_1px_0_rgba(0,0,0,0.15)] md:border-t-0 md:border-b md:border-neutral-200/60 md:bg-neutral-50 md:shadow-none dark:md:border-slate-700/60 dark:md:bg-slate-950",
  primaryTabsFooter:
    "border-t border-neutral-200/70 bg-neutral-50 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-950 dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.35)]",
  orderFlowStrip:
    "border-t border-transparent bg-transparent dark:border-transparent md:border-b md:border-neutral-200/50 md:bg-transparent dark:md:border-slate-700/50",
  activityMainSurface: "bg-neutral-50 dark:bg-slate-950",
  activityShellWrap:
    "!bg-neutral-50 dark:!bg-slate-950 md:!bg-transparent md:!dark:bg-transparent",
  activityViewSection:
    "w-full max-md:space-y-0 space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-4 md:rounded-2xl md:border md:border-neutral-200/60 md:bg-white/90 md:p-4 md:shadow-sm md:dark:border-slate-700/60 md:dark:bg-slate-900/80",
};

/** One brand tint for nav labels, glyphs, empty states, recovery CTAs, and density toggles. */
const SHARED_ACCENT = {
  labelSelected: "text-primary dark:text-brand-accent",
  barSelected: "bg-primary dark:bg-brand-accent",
  glyphSelected: "text-primary dark:text-brand-accent",
  emptySurface:
    "border-primary/30 bg-primary-soft/55 dark:border-brand-accent/35 dark:bg-slate-900/45",
  recoveryPrimary:
    "!border-transparent !bg-primary !text-white shadow-sm !shadow-primary/25 hover:!bg-primary/90 active:!bg-primary/80 focus-visible:!ring-primary/50 dark:!bg-brand-accent dark:hover:!bg-brand-accent/90 dark:focus-visible:!ring-brand-accent/45",
  recoverySecondary:
    "!border-primary !bg-primary-soft/80 !text-primary hover:!bg-primary-soft dark:!border-brand-accent dark:!bg-slate-800/80 dark:!text-brand-accent dark:hover:!bg-slate-800",
  segmentActive:
    "!bg-primary-soft !text-primary shadow-none !ring-1 !ring-inset !ring-primary/35 dark:!bg-slate-800/85 dark:!text-brand-accent dark:!ring-brand-accent/30",
  segmentActiveMuted:
    "!bg-primary-soft/90 !text-primary !ring-1 !ring-inset !ring-primary/25 dark:!bg-slate-800/70 dark:!text-brand-accent dark:!ring-brand-accent/25",
  courierPanelSurface:
    "rounded-xl border border-primary/30 bg-primary-soft/55 p-4 dark:border-brand-accent/35 dark:bg-slate-900/45",
};

/**
 * Activity hub chrome — shared neutral shells; brand-primary tint for accents and content surfaces.
 */
export const ACTIVITY_TAB_CHROME = {
  [ACTIVITY_TABS.COMMERCE_ALL]: { ...SHARED_SHELL, ...SHARED_ACCENT },
  [ACTIVITY_TABS.BUYING]: { ...SHARED_SHELL, ...SHARED_ACCENT },
  [ACTIVITY_TABS.SELLING]: { ...SHARED_SHELL, ...SHARED_ACCENT },
  [ACTIVITY_TABS.BOOKING]: { ...SHARED_SHELL, ...SHARED_ACCENT },
  [ACTIVITY_TABS.COURIER]: { ...SHARED_SHELL, ...SHARED_ACCENT },
};

/** In-flow layout for order-status and courier sub-tab strips (below app header, not fixed). */
const COMMERCE_CHILD_STRIP_LAYOUT =
  "relative z-30 w-full shrink-0 px-1 pt-2 shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:shadow-[0_1px_0_rgba(0,0,0,0.25)] md:mb-2 md:px-0 md:pb-2 md:pt-0 md:shadow-none";

/**
 * Virtual id used by the merged Orders primary tab (My Orders + My Sales toggle).
 * The underlying `activityTab` state still uses BUYING/SELLING — this id is only for chrome lookup
 * and the primary tab UI.
 */
export const ACTIVITY_ORDERS_TAB_ID = "orders";

ACTIVITY_TAB_CHROME[ACTIVITY_ORDERS_TAB_ID] = ACTIVITY_TAB_CHROME[ACTIVITY_TABS.BUYING];

export function getActivityTabChrome(tabId) {
  return ACTIVITY_TAB_CHROME[tabId] ?? ACTIVITY_TAB_CHROME[ACTIVITY_TABS.BUYING];
}

/** Full class string for Pending–Cancelled strip; use when `activityTab` is buying or selling. */
export function commerceOrderStatusStripClass(activityTab) {
  const chrome = getActivityTabChrome(activityTab);
  return `${COMMERCE_CHILD_STRIP_LAYOUT} ${chrome.orderFlowStrip}`;
}

/** Courier Deliver / Active strip — same layout as order-status child strip. */
export function courierHubSubtabStripClass() {
  return commerceOrderStatusStripClass(ACTIVITY_TABS.COURIER);
}

/** @deprecated Use {@link courierHubSubtabStripClass}. */
export function courierHubFooterStripClass() {
  return courierHubSubtabStripClass();
}

/** Fixed viewport footer shell for Activity primary tabs (Buying / Selling / Booking / Courier). */
export function activityPrimaryTabsFooterShellClass(activityTab) {
  const chrome = getActivityTabChrome(activityTab);
  return chrome.primaryTabsFooter;
}
