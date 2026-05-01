import { ACTIVITY_TABS } from "../views.js";

/**
 * Distinct accent + tinted shells for Activity primary tabs (Buying / Selling / Courier),
 * plus matching sticky footer strips for purchases/orders and courier sub-tabs.
 */
export const ACTIVITY_TAB_CHROME = {
  [ACTIVITY_TABS.BUYING]: {
    labelSelected: "text-emerald-600 dark:text-emerald-400",
    barSelected: "bg-emerald-500 dark:bg-emerald-400",
    glyphSelected: "text-emerald-600 dark:text-emerald-400",
    shellMobile:
      "border-t border-emerald-200/90 bg-emerald-50/95 shadow-[0_1px_0_rgba(6,78,59,0.06)] dark:border-emerald-800/45 dark:bg-emerald-950/40 dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]",
    shellDesktop:
      "border-b border-emerald-200/75 bg-emerald-50/90 dark:border-emerald-800/45 dark:bg-emerald-950/45",
    orderFlowStrip:
      "border-t border-emerald-200/90 bg-emerald-50/95 dark:border-emerald-800/55 dark:bg-emerald-950/50 md:border-b md:border-emerald-200/70 md:bg-transparent dark:md:border-emerald-800/55 dark:md:bg-transparent",
    /** ScreenEmpty dashed surface — aligns with Buying chrome */
    emptySurface:
      "border-emerald-200/75 bg-emerald-50/45 dark:border-emerald-800/40 dark:bg-emerald-950/20",
    /** Overrides on `Button` primary — stacked after `lm-btn-primary` */
    recoveryPrimary:
      "!border-transparent !bg-emerald-600 !text-white shadow-sm !shadow-emerald-600/25 hover:!bg-emerald-700 active:!bg-emerald-800 focus-visible:!ring-emerald-500/50 dark:!bg-emerald-500 dark:hover:!bg-emerald-400 dark:focus-visible:!ring-emerald-400/45",
    recoverySecondary:
      "!border-emerald-600 !bg-emerald-100/50 !text-emerald-900 hover:!bg-emerald-100/90 dark:!border-emerald-500 dark:!bg-emerald-950/45 dark:!text-emerald-200 dark:hover:!bg-emerald-950/60",
    /** Full-bleed main scroll when Activity → Buying (matches header/footer mint) */
    activityMainSurface:
      "bg-emerald-50/95 dark:bg-emerald-950/40 md:bg-emerald-50/90 md:dark:bg-emerald-950/35",
    /** Overrides `.mobile-app-shell` white behind header + main on phones */
    activityShellWrap:
      "!bg-emerald-50/95 dark:!bg-emerald-950/40 md:!bg-transparent md:!dark:bg-transparent",
    /** Replaces default `viewSection` white card on md+ for Activity hub */
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-6 md:rounded-2xl md:border md:border-emerald-200/75 md:bg-emerald-50/70 md:p-5 md:shadow-sm md:dark:border-emerald-800/50 md:dark:bg-emerald-950/30",
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
      "border-t border-amber-200/90 bg-amber-50/95 shadow-[0_1px_0_rgba(120,53,15,0.06)] dark:border-amber-800/45 dark:bg-amber-950/40 dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]",
    shellDesktop:
      "border-b border-amber-200/75 bg-amber-50/90 dark:border-amber-800/45 dark:bg-amber-950/45",
    orderFlowStrip:
      "border-t border-amber-200/90 bg-amber-50/95 dark:border-amber-800/55 dark:bg-amber-950/50 md:border-b md:border-amber-200/70 md:bg-transparent dark:md:border-amber-800/55 dark:md:bg-transparent",
    emptySurface:
      "border-amber-200/75 bg-amber-50/45 dark:border-amber-800/40 dark:bg-amber-950/20",
    recoveryPrimary:
      "!border-transparent !bg-amber-600 !text-white shadow-sm !shadow-amber-600/25 hover:!bg-amber-700 active:!bg-amber-800 focus-visible:!ring-amber-500/50 dark:!bg-amber-500 dark:hover:!bg-amber-400 dark:focus-visible:!ring-amber-400/45",
    recoverySecondary:
      "!border-amber-600 !bg-amber-100/50 !text-amber-950 hover:!bg-amber-100/90 dark:!border-amber-500 dark:!bg-amber-950/45 dark:!text-amber-200 dark:hover:!bg-amber-950/60",
    activityMainSurface:
      "bg-amber-50/95 dark:bg-amber-950/40 md:bg-amber-50/90 md:dark:bg-amber-950/35",
    activityShellWrap:
      "!bg-amber-50/95 dark:!bg-amber-950/40 md:!bg-transparent md:!dark:bg-transparent",
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-6 md:rounded-2xl md:border md:border-amber-200/75 md:bg-amber-50/70 md:p-5 md:shadow-sm md:dark:border-amber-800/50 md:dark:bg-amber-950/30",
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
      "border-t border-violet-200/90 bg-violet-50/95 shadow-[0_1px_0_rgba(76,29,149,0.06)] dark:border-violet-800/45 dark:bg-violet-950/40 dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]",
    shellDesktop:
      "border-b border-violet-200/75 bg-violet-50/90 dark:border-violet-800/45 dark:bg-violet-950/45",
    orderFlowStrip:
      "border-t border-violet-200/90 bg-violet-50/95 dark:border-violet-800/55 dark:bg-violet-950/50 md:border-b md:border-violet-200/70 md:bg-transparent dark:md:border-violet-800/55 dark:md:bg-transparent",
    emptySurface:
      "border-violet-200/75 bg-violet-50/45 dark:border-violet-800/40 dark:bg-violet-950/20",
    recoveryPrimary:
      "!border-transparent !bg-violet-600 !text-white shadow-sm !shadow-violet-600/25 hover:!bg-violet-700 active:!bg-violet-800 focus-visible:!ring-violet-500/50 dark:!bg-violet-500 dark:hover:!bg-violet-400 dark:focus-visible:!ring-violet-400/45",
    recoverySecondary:
      "!border-violet-600 !bg-violet-100/50 !text-violet-950 hover:!bg-violet-100/90 dark:!border-violet-500 dark:!bg-violet-950/45 dark:!text-violet-200 dark:hover:!bg-violet-950/60",
    activityMainSurface:
      "bg-violet-50/95 dark:bg-violet-950/40 md:bg-violet-50/90 md:dark:bg-violet-950/35",
    activityShellWrap:
      "!bg-violet-50/95 dark:!bg-violet-950/40 md:!bg-transparent md:!dark:bg-transparent",
    activityViewSection:
      "w-full space-y-4 border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:space-y-6 md:rounded-2xl md:border md:border-violet-200/75 md:bg-violet-50/70 md:p-5 md:shadow-sm md:dark:border-violet-800/50 md:dark:bg-violet-950/30",
    segmentActive:
      "!bg-violet-100 !text-violet-950 shadow-none !ring-1 !ring-inset !ring-violet-300/45 dark:!bg-violet-950/55 dark:!text-violet-100 dark:!ring-violet-600/35",
    segmentActiveMuted:
      "!bg-violet-100/95 !text-violet-950 !ring-1 !ring-inset !ring-violet-400/50 dark:!bg-violet-950/70 dark:!text-violet-100 dark:!ring-violet-500/45",
    /** Optional modes card — matches Courier nav / footer strip tint */
    courierPanelSurface:
      "rounded-xl border border-violet-200/75 bg-violet-50/50 p-4 dark:border-violet-800/45 dark:bg-violet-950/25",
  },
};

/** Layout shared by purchases/orders status strip and courier hub strip (sticky mobile footer). */
const COMMERCE_TAB_STRIP_LAYOUT =
  "z-40 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:px-1 max-md:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] max-md:pt-2 max-md:shadow-[0_-1px_0_rgba(15,23,42,0.05)] dark:max-md:shadow-[0_-1px_0_rgba(0,0,0,0.35)] md:relative md:mb-2 md:pb-2 md:shadow-none";

export function getActivityTabChrome(tabId) {
  return ACTIVITY_TAB_CHROME[tabId] ?? ACTIVITY_TAB_CHROME[ACTIVITY_TABS.BUYING];
}

/** Full class string for Pending–Cancelled strip; use when `activityTab` is buying or selling. */
export function commerceOrderStatusStripClass(activityTab) {
  const chrome = getActivityTabChrome(activityTab);
  return `${COMMERCE_TAB_STRIP_LAYOUT} ${chrome.orderFlowStrip}`;
}

/** Courier hub bottom tab strip — violet, aligned with Activity → Courier. */
export function courierHubFooterStripClass() {
  return commerceOrderStatusStripClass(ACTIVITY_TABS.COURIER);
}
