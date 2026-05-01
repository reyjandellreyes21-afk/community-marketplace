export const UI_KIT = {
  /** Fluid mobile column — use `mobile-app-shell` (full width + safe horizontal inset); outer background is on the App root. */
  mobileAppShell: "mobile-app-shell",
  /** Main scroll region — mobile shells `<main>` as scrollport; md+ uses document scroll so wheel works over content (see overscroll). */
  mobileMainScroll:
    "relative flex-1 min-h-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain md:overflow-y-visible md:overscroll-y-auto",
  /**
   * Mobile: full-bleed, spacing + light dividers only (no boxed card).
   * md+: optional subtle card for wider layouts.
   */
  viewSection:
    "w-full border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent md:rounded-2xl md:border md:border-neutral-200/85 md:bg-surface md:p-5 md:shadow-sm md:dark:border-[#1f3c56] md:dark:bg-[#0f2234]",
  /** Mirrors `.ui-section-title` / `.ui-section-subtitle` (`index.css`) — use classes when possible */
  sectionTitle:
    "text-lg font-semibold leading-snug tracking-tight text-text-primary dark:text-slate-100 min-[400px]:text-xl md:text-[1.65rem] md:leading-tight",
  sectionSubtitle:
    "mt-1 text-sm leading-relaxed text-text-secondary dark:text-slate-400 min-[400px]:text-[15px] md:text-sm",
  headerEyebrow: "text-[11px] font-semibold uppercase tracking-wide text-primary dark:text-brand-accent",
  /** Bordered card shell — see `.lm-card` in `index.css` */
  surfaceCard: "lm-card",
  surfaceRaised:
    "lm-card md:bg-gradient-to-b md:from-surface md:to-primary-soft/25 md:shadow-sm md:shadow-slate-900/[0.04] dark:md:from-[#0f2234] dark:md:to-[#11283d]/92 dark:md:shadow-none md:dark:border-border",
  surfaceFloating:
    "lm-card md:shadow-[0_12px_40px_-18px_rgba(15,23,42,0.10)] md:dark:shadow-[0_18px_45px_rgba(31,166,166,0.1)]",
  surfaceMuted:
    "lm-card border-neutral-200/75 bg-primary-soft/40 dark:border-slate-600/65 dark:bg-[#11283d]/60 md:border-neutral-200/70 md:dark:border-[#1f3c56]/90",
  stateSuccess:
    "border-emerald-200/90 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  stateWarning:
    "border-amber-200/90 bg-amber-50/90 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  stateDanger: "border-rose-200/90 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  chipActive:
    "inline-flex max-w-full min-w-0 items-center truncate rounded-full border border-primary/28 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary dark:border-brand-accent/32 dark:bg-slate-800 dark:text-slate-100",
  chipMuted:
    "inline-flex max-w-full min-w-0 items-center truncate rounded-full border border-neutral-200/90 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  /** Matches chip / segment “selected” tokens — pairs with `lm-btn-segment-active` + density toggle */
  tabActive:
    "border border-primary/28 bg-primary-soft text-primary ring-1 ring-primary/20 outline-none transition-colors duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-brand-accent/32 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-accent/22 dark:focus-visible:ring-brand-accent/40 dark:focus-visible:ring-offset-slate-950",
  tabIdle:
    "border border-neutral-300/95 bg-white/90 text-text-secondary outline-none touch-manipulation transition-colors duration-150 ease-out hover:bg-neutral-50 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-brand-accent/40 dark:focus-visible:ring-offset-slate-950",
};
