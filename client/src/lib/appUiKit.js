export const UI_KIT = {
  /** Fluid mobile column — use `mobile-app-shell` (full width + safe horizontal inset); outer background is on the App root. */
  mobileAppShell: "mobile-app-shell",
  /** Main scroll region — paired with `pb` / `scroll-pb` so content clears the bottom tab bar + safe area. */
  mobileMainScroll:
    "relative flex-1 min-h-0 touch-pan-y overflow-y-auto overscroll-y-contain",
  /**
   * Mobile: full-bleed, spacing + light dividers only (no boxed card).
   * md+: optional subtle card for wider layouts.
   */
  viewSection:
    "w-full border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:rounded-2xl md:border md:border-neutral-200/85 md:bg-surface md:p-5 md:shadow-sm md:dark:border-[#1f3c56] md:dark:bg-[#0f2234]",
  sectionTitle: "text-[1.65rem] font-semibold tracking-tight text-text-primary dark:text-slate-100",
  sectionSubtitle: "mt-1 text-sm leading-relaxed text-text-secondary dark:text-slate-400",
  headerEyebrow: "text-[11px] font-semibold uppercase tracking-wide text-primary dark:text-brand-accent",
  surfaceCard:
    "rounded-xl border border-neutral-200/75 bg-white shadow-none dark:border-slate-700/75 dark:bg-[#0f2234]/95 md:rounded-2xl md:shadow-sm md:dark:border-[#1f3c56]",
  surfaceRaised:
    "rounded-xl border border-neutral-200/60 bg-white md:rounded-2xl md:border-border md:bg-gradient-to-b md:from-surface md:to-primary-soft/25 md:shadow-sm dark:border-slate-700/55 dark:bg-slate-900/45 md:dark:from-[#0f2234] md:dark:to-[#11283d]/90",
  surfaceFloating:
    "rounded-2xl border border-neutral-200/85 bg-white shadow-[0_12px_40px_-18px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-[#0f2234]/95 md:shadow-[0_18px_45px_rgba(31,166,166,0.1)]",
  surfaceMuted:
    "rounded-xl border border-transparent bg-primary-soft/45 dark:border-slate-700/55 dark:bg-[#11283d]/55 md:border-neutral-200/70 md:dark:border-[#1f3c56]/90",
  stateSuccess:
    "border-emerald-200/90 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  stateWarning:
    "border-amber-200/90 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  stateDanger: "border-rose-200/90 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  chipActive:
    "inline-flex items-center rounded-full border border-primary/28 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary dark:border-brand-accent/32 dark:bg-slate-800 dark:text-slate-100",
  chipMuted:
    "inline-flex items-center rounded-full border border-neutral-200/90 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  tabActive:
    "bg-primary-soft text-primary ring-1 ring-primary/22 active:scale-[0.98] motion-reduce:active:scale-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-accent/22",
  tabIdle:
    "border border-neutral-200/90 text-text-secondary touch-manipulation transition hover:bg-neutral-50 active:scale-[0.98] motion-reduce:active:scale-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800",
};
