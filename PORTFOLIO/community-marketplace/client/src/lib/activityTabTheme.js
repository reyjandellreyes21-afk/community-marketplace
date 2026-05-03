import { ACTIVITY_TABS } from "../views.js";

/**
 * Distinct accent + tinted shells for Activity primary tabs (Buying / Selling / Courier),
 * fixed footer for primary tabs, and child strips (order status / courier sub-tabs) under the header.
 */
export const ACTIVITY_TAB_CHROME = {
  [ACTIVITY_TABS.BUYING]: {
    labelSelected: "text-emerald-600 dark:text-emerald-400",
    barSelected: "bg-emerald-500 dark:bg-emerald-400",
    glyphSelected: "text-emerald-600 dark:text-emerald-400",
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
    /** ScreenEmpty dashed surface — aligns with Buying chrome */
    emptySurface:
      "border-emerald-200/75 bg-emerald-50/45 dark:border-emerald-800/40 dark:bg-emerald-950/20",
    /** Overrides on `Button` primary — stacked after `lm-btn-primary` */
    recoveryPrimary:
      "!border-transparent !bg-emerald-600 !text-white shadow-sm !shadow-emerald-600/25 hover:!bg-emerald-700 active:!bg-emerald-800 focus-visible:!ring-emerald-500/50 dark:!bg-emerald-500 dark:hover:!bg-emerald-400 dark:focus-visible:!ring-emerald-400/45",
    recoverySecondary:
      "!border-emerald-600 !bg-emerald-100/50 !text-emerald-900 hover:!bg-emerald-100/90 dark:!border-emerald-500 dark:!bg-emerald-950/45 dark:!text-emerald-200 dark:hover:!bg-emerald-950/60",
    /** Same canvas as strips/footer — avoids mint vs white banding on mobile. */
    activityMainSurface:
      "bg-neutral-50 dark:bg-slate-950",
    activityShellWrap:
      "!bg-neutral-50 dark:!bg-slate-950 md:!bg-transparent md:!dark:bg-transparent",
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-4 md:rounded-2xl md:border md:border-neutral-200/60 md:bg-white/90 md:p-4 md:shadow-sm md:dark:border-slate-700/60 md:dark:bg-slate-900/80",
    /** Density toggle selected segment — replaces `lm-btn-segment-active` */
    segmentActive:
      "!bg-emerald-100 !text-emerald-900 shadow-none !ring-1 !ring-inset !ring-emerald-300/45 dark:!bg-emerald-950/55 dark:!text-emerald-100 dark:!ring-emerald-600/35",
    segmentActiveMuted:
      "!bg-emerald-100/95 !text-emerald-950 !ring-1 !ring-inset !ring-emerald-400/50 dark:!bg-emerald-950/70 dark:!text-emerald-100 dark:!ring-emerald-500/45",
  },
  [ACTIVITY_TABS.SELLING]: {
    labelSelected: "text-amber-600 dark:text-amber-400",
    barSelected: "bg-amber-500 dark:bg-amber-400",
    glyphSelected: "text-amber-600 dark:text-amber-400",
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
    emptySurface:
      "border-amber-200/75 bg-amber-50/45 dark:border-amber-800/40 dark:bg-amber-950/20",
    recoveryPrimary:
      "!border-transparent !bg-amber-600 !text-white shadow-sm !shadow-amber-600/25 hover:!bg-amber-700 active:!bg-amber-800 focus-visible:!ring-amber-500/50 dark:!bg-amber-500 dark:hover:!bg-amber-400 dark:focus-visible:!ring-amber-400/45",
    recoverySecondary:
      "!border-amber-600 !bg-amber-100/50 !text-amber-950 hover:!bg-amber-100/90 dark:!border-amber-500 dark:!bg-amber-950/45 dark:!text-amber-200 dark:hover:!bg-amber-950/60",
    activityMainSurface:
      "bg-neutral-50 dark:bg-slate-950",
    activityShellWrap:
      "!bg-neutral-50 dark:!bg-slate-950 md:!bg-transparent md:!dark:bg-transparent",
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-4 md:rounded-2xl md:border md:border-neutral-200/60 md:bg-white/90 md:p-4 md:shadow-sm md:dark:border-slate-700/60 md:dark:bg-slate-900/80",
    segmentActive:
      "!bg-amber-100 !text-amber-950 shadow-none !ring-1 !ring-inset !ring-amber-300/45 dark:!bg-amber-950/55 dark:!text-amber-100 dark:!ring-amber-600/35",
    segmentActiveMuted:
      "!bg-amber-100/95 !text-amber-950 !ring-1 !ring-inset !ring-amber-400/50 dark:!bg-amber-950/70 dark:!text-amber-100 dark:!ring-amber-500/45",
  },
  [ACTIVITY_TABS.COURIER]: {
    labelSelected: "text-violet-600 dark:text-violet-400",
    barSelected: "bg-violet-500 dark:bg-violet-400",
    glyphSelected: "text-violet-600 dark:text-violet-400",
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
    emptySurface:
      "border-violet-200/75 bg-violet-50/45 dark:border-violet-800/40 dark:bg-violet-950/20",
    recoveryPrimary:
      "!border-transparent !bg-violet-600 !text-white shadow-sm !shadow-violet-600/25 hover:!bg-violet-700 active:!bg-violet-800 focus-visible:!ring-violet-500/50 dark:!bg-violet-500 dark:hover:!bg-violet-400 dark:focus-visible:!ring-violet-400/45",
    recoverySecondary:
      "!border-violet-600 !bg-violet-100/50 !text-violet-950 hover:!bg-violet-100/90 dark:!border-violet-500 dark:!bg-violet-950/45 dark:!text-violet-200 dark:hover:!bg-violet-950/60",
    activityMainSurface:
      "bg-neutral-50 dark:bg-slate-950",
    activityShellWrap:
      "!bg-neutral-50 dark:!bg-slate-950 md:!bg-transparent md:!dark:bg-transparent",
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-4 md:rounded-2xl md:border md:border-neutral-200/60 md:bg-white/90 md:p-4 md:shadow-sm md:dark:border-slate-700/60 md:dark:bg-slate-900/80",
    segmentActive:
      "!bg-violet-100 !text-violet-950 shadow-none !ring-1 !ring-inset !ring-violet-300/45 dark:!bg-violet-950/55 dark:!text-violet-100 dark:!ring-violet-600/35",
    segmentActiveMuted:
      "!bg-violet-100/95 !text-violet-950 !ring-1 !ring-inset !ring-violet-400/50 dark:!bg-violet-950/70 dark:!text-violet-100 dark:!ring-violet-500/45",
    /** Optional modes card — matches Courier nav / footer strip tint */
    courierPanelSurface:
      "rounded-xl border border-violet-200/75 bg-violet-50/50 p-4 dark:border-violet-800/45 dark:bg-violet-950/25",
  },
};

/** In-flow layout for order-status and courier sub-tab strips (below app header, not fixed). */
const COMMERCE_CHILD_STRIP_LAYOUT =
  "relative z-30 w-full shrink-0 px-1 pt-2 shadow-[0_1px_0_rgba(15,23,42,0.05)] dark:shadow-[0_1px_0_rgba(0,0,0,0.25)] md:mb-2 md:px-0 md:pb-2 md:pt-0 md:shadow-none";

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

/** Fixed viewport footer shell for Activity primary tabs (Buying / Selling / Courier). */
export function activityPrimaryTabsFooterShellClass(activityTab) {
  const chrome = getActivityTabChrome(activityTab);
  return chrome.primaryTabsFooter;
}
