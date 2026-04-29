import { UI_KIT } from "../../lib/appUiKit.js";

/**
 * Mobile design system — **viewports below the `md` breakpoint (768px)** unless a token adds `md:`.
 *
 * **Sources of truth (do not fork casually):**
 * - CSS primitives: `src/index.css` (`:root` tokens, `.btn-*`, `.input-base`, `.app-card`, `.badge-*`, `.app-alert-*`)
 * - Tailwind theme: `tailwind.config.js` (`colors`, `screens`)
 * - Composite surfaces / chips: `src/lib/appUiKit.js` (`UI_KIT`)
 * - Interactive primitives: `src/components/ui/*` (`Button`, `Input`, `Card`, `Badge`, `ScreenState`)
 *
 * Use with `cn()` in JSX. Prefer these tokens over one-off Tailwind strings for marketplace consistency.
 */
export const MOBILE_DESIGN_SYSTEM = {
  /**
   * Typography — **mobile-first**; CSS counterparts live in `index.css` (`.mobile-page-title`, `.product-*`, `.ui-section-*`).
   * Sizes: page title ~22–24px bold; section ~18–20px semibold; card title ~15–17px; body 14–16px; meta 11–13px; buttons 15px→md 14px.
   */
  typography: {
    /** `<h1>` / primary modal title — see `.mobile-page-title` */
    pageTitle: "mobile-page-title",
    /** Section `<h2>` — see `.ui-section-title` */
    sectionTitle: "ui-section-title",
    /** Product / listing name on cards — see `.product-card-title` (truncate; pair with `min-w-0`) */
    cardTitle: "product-card-title",
    /** Listing price — see `.product-price` */
    price: "product-price",
    /** Uppercase row labels (Stock, Fulfillment, …) — see `.product-meta-label` */
    metaLabel: "product-meta-label",
    /** Numeric emphasis (stock qty) — see `.product-meta-value` */
    metaValue: "product-meta-value",
    /** Fulfillment / prose meta — see `.product-meta-body` */
    metaBody: "product-meta-body",
    /** Clamped description blurb — see `.product-description-preview` */
    descriptionPreview: "product-description-preview",
    /** Large marketing / hero (use sparingly on phones) */
    display: "text-2xl font-bold leading-tight tracking-tight text-text-primary dark:text-slate-100 md:text-[1.75rem] md:font-semibold",
    /** Default reading — follows global `body` (14px → 16px min-[400px]) */
    body: "text-sm leading-relaxed text-text-primary dark:text-slate-100 min-[400px]:text-base",
    /** Secondary paragraphs */
    bodySecondary: "text-sm leading-relaxed text-text-secondary dark:text-slate-400 min-[400px]:text-[15px]",
    /** Captions / timestamps — avoid below 11px */
    caption: "text-xs leading-snug text-neutral-600 dark:text-slate-400",
    /** Dense metadata (11–13px) */
    meta: "text-[11px] font-medium leading-snug text-neutral-600 dark:text-slate-400 min-[380px]:text-xs",
    /** Uppercase section labels — pairs with `UI_KIT.headerEyebrow` */
    eyebrow: UI_KIT.headerEyebrow,
    /** Form labels — pairs with `.label-base` */
    label: "label-base",
    /** Inline emphasis / links */
    link: "text-sm font-medium text-brand-primary underline-offset-4 hover:underline dark:text-brand-accent",
  },

  spacing: {
    /** Horizontal page gutters — aligns with `.app-container` / `.app-shell-content-inset` on mobile */
    pageX: "px-3.5",
    /** Fluid horizontal inset for sections that are not inside `.app-container` */
    insetX: "px-[clamp(0.625rem,3.2vw,0.875rem)]",
    /** Default vertical stack inside screens */
    sectionY: "space-y-5",
    /** Tight stacks (metadata rows, chip rows) */
    stackSm: "space-y-2",
    /** Between grouped blocks */
    stackMd: "space-y-3",
    /** Comfortable stacks */
    stackLg: "space-y-5",
    /** Flex / grid gaps */
    gapSm: "gap-2",
    gapMd: "gap-3",
    gapLg: "gap-4",
    /** End of scroll region: safe area + breath — use on `<main>` mobile shell (see `App.jsx`) */
    scrollPaddingBottom: "scroll-pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))]",
    paddingBottom: "pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))]",
  },

  /**
   * Semantic colors — always pair light/dark. Maps to `theme.extend.colors` + neutral slate ramp.
   */
  color: {
    textPrimary: "text-text-primary dark:text-slate-100",
    textSecondary: "text-text-secondary dark:text-slate-400",
    textMuted: "text-neutral-500 dark:text-slate-500",
    borderDefault: "border-neutral-200/90 dark:border-slate-600/90",
    borderSubtle: "border-neutral-200/70 dark:border-slate-700/70",
    surfacePage: "bg-white dark:bg-slate-950",
    surfaceElevated: "bg-white dark:bg-[#0f2234]",
    surfaceMuted: "bg-primary-soft/45 dark:bg-[#11283d]/55",
    brand: "text-primary dark:text-brand-accent",
    brandBg: "bg-primary-soft dark:bg-slate-800",
    focusRing:
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/35 dark:focus-visible:ring-offset-slate-950",
  },

  /**
   * Buttons — implement `Button` or raw `<button>` with these classes (`lm-btn*` in `index.css`).
   * Legacy `btn-*` aliases remain identical for older markup.
   */
  button: {
    base: "lm-btn",
    primary: "lm-btn-primary",
    secondary: "lm-btn-secondary",
    ghost: "lm-btn-ghost",
    danger: "lm-btn-danger",
    accent: "lm-btn-accent",
    iconOnly: "lm-btn-icon",
    chip: "lm-btn-chip",
    chipActive: "lm-btn-chip-active",
    segment: "lm-btn-segment",
    segmentActive: "lm-btn-segment-active",
    segmentIdle: "lm-btn-segment-idle",
    sm: "lm-btn-sm",
    lg: "lm-btn-lg",
    full: "lm-btn-full",
    fullWidth: "lm-btn-full",
  },

  /**
   * Form fields — pair `Input`/`Textarea`/`Label` or apply classes directly.
   * Mobile: 44px min height + `text-base` via `.input-base`.
   */
  input: {
    field: "input-base",
    textarea: "textarea-base",
    label: "label-base",
    invalid:
      "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30",
    placeholder: "placeholder:text-neutral-400 dark:placeholder:text-slate-500",
  },

  /**
   * Cards / surfaces — prefer `<Card variant />`; otherwise use `UI_KIT` or `.app-card` / `.lm-card*` (`index.css`).
   */
  card: {
    appDefault: "app-card",
    appInteractive: "app-card-interactive",
    /** Bordered mobile-first shell — see `UI_KIT.surfaceCard` */
    shell: "lm-card",
    shellInteractive: "lm-card-interactive",
    uiDefault: UI_KIT.surfaceCard,
    uiRaised: UI_KIT.surfaceRaised,
    uiFloating: UI_KIT.surfaceFloating,
    uiMuted: UI_KIT.surfaceMuted,
    viewSection: UI_KIT.viewSection,
  },

  /** Filter / pill chips — not the same as `Badge` (badges are smaller status pills). */
  chip: {
    active: UI_KIT.chipActive,
    muted: UI_KIT.chipMuted,
    tabActive: UI_KIT.tabActive,
    tabIdle: UI_KIT.tabIdle,
  },

  /**
   * Status badges — prefer `<Badge variant />`; class names match `index.css`.
   */
  badge: {
    success: "badge-success",
    sale: "badge-sale",
    neutral: "badge-neutral",
    primary: "badge-primary",
    touch: "badge-touch",
  },

  /** Icon sizing — keep glyphs visually balanced inside `button.iconOnly` / list rows */
  icon: {
    sm: "h-4 w-4 shrink-0",
    md: "h-5 w-5 shrink-0",
    nav: "h-[22px] w-[22px] shrink-0",
    touchTarget: "h-[var(--ui-touch-target)] w-[var(--ui-touch-target)] shrink-0",
  },

  /** Full-width empty / success / error templates — use `ScreenEmpty` / `ScreenSuccess` / `ScreenError` components */
  screen: {
    empty: {
      surface: UI_KIT.surfaceRaised,
      title: "text-lg font-semibold text-neutral-900 dark:text-slate-100 min-[400px]:text-xl md:text-xl",
      description: "mt-2 max-w-mobile-baseline text-sm leading-relaxed text-neutral-600 dark:text-slate-400 min-[400px]:text-[15px] md:max-w-md",
    },
    loading: {
      /** Minimum height for main-pane loaders */
      minHeight: "min-h-[min(42dvh,16rem)]",
      surface: UI_KIT.surfaceMuted,
      spinner:
        "h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-brand-primary border-t-transparent motion-reduce:animate-none dark:border-brand-accent dark:border-t-transparent",
      message:
        "max-w-mobile-baseline text-sm font-medium leading-relaxed text-neutral-700 dark:text-slate-300 min-[400px]:text-[15px]",
    },
    success: {
      surface: UI_KIT.stateSuccess,
      title: "text-lg font-semibold text-emerald-900 dark:text-emerald-50 min-[400px]:text-xl md:text-xl",
      description:
        "mt-2 max-w-mobile-baseline text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/90 min-[400px]:text-[15px] md:max-w-md",
    },
    error: {
      banner: "app-alert-error",
      field: "field-error-text",
      /** Block ScreenError layout — prefer `<ScreenError />` */
      panel:
        "app-alert-error flex flex-col gap-3 rounded-xl border border-rose-200/90 px-4 py-4 text-left dark:border-rose-900/40",
    },
  },

  /**
   * Image & media placeholders — use until `img`/`Image` load; keeps layout stable (pair with `aspect-*`).
   */
  imagePlaceholder: {
    base: "animate-pulse bg-neutral-200/60 dark:bg-slate-700/60",
    rounded: "rounded-[var(--ui-radius-lg)]",
    listing: "aspect-[4/3] w-full rounded-[var(--ui-radius-lg)]",
    /** Landscape cards / banners */
    wide: "aspect-[16/10] w-full rounded-[var(--ui-radius-lg)]",
  },

  /** Flex/grid text overflow — pair with long user-generated content */
  overflow: {
    flexChild: "min-w-0",
    lineClamp2: "line-clamp-2 min-w-0 break-words",
    metaSingle: "truncate min-w-0",
  },

  /** Layout helpers shared with legacy `MOBILE_UI` exports */
  layout: {
    touchMinH: "min-h-[var(--ui-touch-target)]",
    touchSquare: "h-[var(--ui-touch-target)] w-[var(--ui-touch-target)] shrink-0",
    touchManip: "touch-manipulation",
    radius: "rounded-[var(--ui-radius)]",
    radiusLg: "rounded-[var(--ui-radius-lg)]",
    radiusFull: "rounded-[var(--ui-radius-full)]",
  },
};

/**
 * Flat shortcuts — **backward compatible** with existing imports. Prefer `MOBILE_DESIGN_SYSTEM` for new work.
 */
export const MOBILE_UI = {
  touchMinH: MOBILE_DESIGN_SYSTEM.layout.touchMinH,
  touchSquare: MOBILE_DESIGN_SYSTEM.layout.touchSquare,
  touchManip: MOBILE_DESIGN_SYSTEM.layout.touchManip,
  radius: MOBILE_DESIGN_SYSTEM.layout.radius,
  radiusLg: MOBILE_DESIGN_SYSTEM.layout.radiusLg,
  radiusFull: MOBILE_DESIGN_SYSTEM.layout.radiusFull,
  insetX: MOBILE_DESIGN_SYSTEM.spacing.insetX,
  stackGap: MOBILE_DESIGN_SYSTEM.spacing.gapLg,
  sectionStack: MOBILE_DESIGN_SYSTEM.spacing.sectionY,
  textBody: "text-sm leading-relaxed min-[400px]:text-base",
  textLabel: "text-[13px] font-medium leading-snug text-neutral-700 dark:text-slate-300 md:text-sm",
  textTitle:
    "text-[15px] font-semibold leading-snug tracking-tight text-text-primary dark:text-slate-100 min-[390px]:text-base",
  screenStateMin: MOBILE_DESIGN_SYSTEM.screen.loading.minHeight,
  /** Pointer to grouped tokens */
  designSystem: MOBILE_DESIGN_SYSTEM,
};
