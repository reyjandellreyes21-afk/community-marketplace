import { Button } from "./Button.jsx";
import { cn } from "../../lib/cn.js";
import { UI_KIT } from "../../lib/appUiKit.js";
import { MOBILE_UI, MOBILE_DESIGN_SYSTEM } from "../../lib/mobileUi.js";

function CheckCircleIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/** Full-width recovery controls on phones; side-by-side from `md` where space allows. */
const recoveryRowClass = "mt-6 flex w-full max-w-none flex-col gap-3 md:mx-auto md:flex-row md:flex-wrap md:justify-center";

/** Full-width primary recovery on mobile (`Button` default height = 44px tap area). */
function RecoveryButtons({ primaryAction, secondaryAction }) {
  if (!primaryAction && !secondaryAction) return null;
  return (
    <div className={recoveryRowClass}>
      {primaryAction ? (
        <Button
          type="button"
          variant="primary"
          fullWidth
          className="md:w-auto md:min-w-[10rem]"
          onClick={primaryAction.onClick}
        >
          {primaryAction.label}
        </Button>
      ) : null}
      {secondaryAction ? (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="md:w-auto md:min-w-[10rem]"
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Full-width loading placeholder — tuned for mobile shells (`MOBILE_DESIGN_SYSTEM.screen.loading.minHeight`).
 * Use inside narrow layouts / browse grids; set `minHeight={false}` for inline strips.
 */
export function ScreenLoading({
  message = "Loading…",
  className = "",
  minHeight = true,
  /** Larger vertical footprint on mobile main surfaces */
  spacious = false,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        MOBILE_DESIGN_SYSTEM.screen.loading.surface,
        "flex flex-col items-center justify-center gap-3 border-dashed px-4 py-12 text-center md:py-14",
        minHeight && (spacious ? cn(MOBILE_UI.screenStateMin, "py-14 md:py-16") : "min-h-[12rem]"),
        className,
      )}
    >
      <span className={MOBILE_DESIGN_SYSTEM.screen.loading.spinner} aria-hidden />
      <p className={cn("max-w-mobile-baseline", MOBILE_DESIGN_SYSTEM.screen.loading.message)}>{message}</p>
    </div>
  );
}

/** Empty state with optional primary / secondary recovery (44px targets on mobile). */
export function ScreenEmpty({
  title,
  description,
  primaryAction,
  secondaryAction,
  /** Shows a top-right dismiss control (e.g. profile reminders). */
  onDismiss,
  spacious = true,
  className = "",
}) {
  return (
    <div
      className={cn(
        UI_KIT.surfaceRaised,
        "relative flex flex-col items-center justify-center border-dashed px-4 py-10 text-center md:px-6 md:py-14",
        onDismiss && "pr-11 pt-3 md:pr-12",
        spacious && MOBILE_UI.screenStateMin,
        className,
      )}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-lg leading-none text-neutral-500 transition hover:bg-neutral-200/80 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 dark:focus-visible:ring-brand-accent/40 dark:focus-visible:ring-offset-slate-900"
        >
          <span aria-hidden className="block translate-y-[-0.05em]">
            ×
          </span>
        </button>
      ) : null}
      <p className={cn("max-w-mobile-baseline text-balance", MOBILE_DESIGN_SYSTEM.screen.empty.title)}>{title}</p>
      {description ? (
        <p className={cn("mt-2 break-words text-pretty", MOBILE_DESIGN_SYSTEM.screen.empty.description)}>{description}</p>
      ) : null}
      <RecoveryButtons primaryAction={primaryAction} secondaryAction={secondaryAction} />
    </div>
  );
}

/**
 * Block-level success — use after completing checkout, publishing, etc.
 * Pair with `InlineSuccess` for lightweight banners.
 */
export function ScreenSuccess({
  title,
  description,
  primaryAction,
  secondaryAction,
  spacious = true,
  className = "",
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        UI_KIT.stateSuccess,
        "flex flex-col items-center justify-center rounded-xl border px-4 py-10 text-center md:px-6 md:py-12",
        spacious && MOBILE_UI.screenStateMin,
        className,
      )}
    >
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
        <CheckCircleIcon className="h-9 w-9" />
      </span>
      <p className={MOBILE_DESIGN_SYSTEM.screen.success.title}>{title}</p>
      {description ? (
        <p className={cn("mt-2", MOBILE_DESIGN_SYSTEM.screen.success.description)}>{description}</p>
      ) : null}
      <RecoveryButtons primaryAction={primaryAction} secondaryAction={secondaryAction} />
    </div>
  );
}

/**
 * Error state with retry + optional secondary recovery (e.g. browse / go back).
 * Always pass `onRetry` and/or `secondaryAction` on mobile so users aren’t stuck.
 */
export function ScreenError({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  /** Taller layout when the error is the whole mobile surface (adds comfortable vertical rhythm). */
  spacious = false,
  className = "",
}) {
  return (
    <div
      className={cn(
        MOBILE_DESIGN_SYSTEM.screen.error.panel,
        spacious && cn(MOBILE_UI.screenStateMin, "justify-center py-8 md:py-10"),
        className,
      )}
      role="alert"
    >
      <div>
        <p className="font-semibold text-rose-900 dark:text-rose-50">{title}</p>
        {message ? (
          <p className="mt-1 break-words text-pretty text-sm text-rose-800 dark:text-rose-100">{message}</p>
        ) : null}
        {!message ? (
          <p className="mt-1 text-sm text-rose-800/90 dark:text-rose-100/90">
            Check your connection, then try again. If it keeps happening, use another action below.
          </p>
        ) : null}
      </div>
      {onRetry || secondaryAction ? (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          {onRetry ? (
            <Button type="button" variant="primary" fullWidth className="md:w-auto md:min-w-[10rem]" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              className="md:w-auto md:min-w-[10rem]"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Inline success callout (non-blocking). */
export function InlineSuccess({ children, className = "" }) {
  return (
    <div className={cn(UI_KIT.stateSuccess, "rounded-xl border px-3 py-2 text-sm", className)} role="status" aria-live="polite">
      {children}
    </div>
  );
}

/**
 * Convenience gate: one of loading → error → success screen → empty → children.
 * Order matches common flows (don’t show empty while loading). Success is optional full-screen.
 */
export function MobileScreenGate({
  children,
  isLoading,
  loadingMessage = "Loading…",
  loadingSpacious = false,
  error,
  errorTitle,
  onRetry,
  retryLabel,
  errorSecondaryAction,
  /** Full-surface error layout (default true when using this gate for a whole mobile screen). */
  errorSpacious = true,
  showSuccessScreen,
  successTitle,
  successDescription,
  successPrimaryAction,
  successSecondaryAction,
  successSpacious = true,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyPrimaryAction,
  emptySecondaryAction,
  emptySpacious = true,
}) {
  if (isLoading) {
    return <ScreenLoading message={loadingMessage} spacious={loadingSpacious} />;
  }
  if (error) {
    return (
      <ScreenError
        title={errorTitle ?? "Something went wrong"}
        message={typeof error === "string" ? error : undefined}
        onRetry={onRetry}
        retryLabel={retryLabel}
        secondaryAction={errorSecondaryAction}
        spacious={errorSpacious}
      />
    );
  }
  if (showSuccessScreen && successTitle) {
    return (
      <ScreenSuccess
        title={successTitle}
        description={successDescription}
        primaryAction={successPrimaryAction}
        secondaryAction={successSecondaryAction}
        spacious={successSpacious}
      />
    );
  }
  if (isEmpty && emptyTitle) {
    return (
      <ScreenEmpty
        title={emptyTitle}
        description={emptyDescription}
        primaryAction={emptyPrimaryAction}
        secondaryAction={emptySecondaryAction}
        spacious={emptySpacious}
      />
    );
  }
  return children;
}
