/**
 * Shared typography for “Rate this purchase” / “Rate the seller” / courier rating sections
 * so order review UI reads as one system.
 */
export function buyerReviewSectionTitle(compact) {
  return compact
    ? "text-sm font-semibold leading-snug tracking-tight text-neutral-900 dark:text-slate-100"
    : "text-base font-semibold leading-snug tracking-tight text-neutral-900 dark:text-slate-100";
}

export function buyerReviewSectionSubtitle(compact) {
  return `mt-1 text-neutral-600 dark:text-slate-400 ${
    compact ? "text-[10px] leading-relaxed" : "text-xs leading-relaxed"
  }`;
}

/** Read-only summary cards (e.g. order timeline) — same weight and color, slightly smaller for density. */
export const buyerReviewSectionTitleSummary =
  "text-sm font-semibold leading-snug tracking-tight text-neutral-900 dark:text-slate-100";

/** Shared shell for purchase / seller / courier rating forms — one neutral card treatment. */
export function buyerReviewCardShell(compact) {
  return `rounded-lg border border-neutral-200/90 bg-neutral-50/80 dark:border-slate-600 dark:bg-slate-900/40 ${
    compact ? "p-2 md:p-2.5" : "p-2.5 md:p-3"
  }`;
}
