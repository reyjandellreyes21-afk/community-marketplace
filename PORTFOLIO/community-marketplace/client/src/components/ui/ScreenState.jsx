import { Button } from "./Button.jsx";
import { cn } from "../../lib/cn.js";
import { UI_KIT } from "../../lib/appUiKit.js";

/** Full-width loading placeholder for a screen or major panel (mobile-friendly). */
export function ScreenLoading({ message = "Loading…", className = "", minHeight = true }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        UI_KIT.surfaceMuted,
        "flex flex-col items-center justify-center gap-3 border-dashed px-4 py-12 text-center md:py-14",
        minHeight && "min-h-[12rem]",
        className,
      )}
    >
      <span
        className="h-9 w-9 animate-spin rounded-full border-2 border-brand-primary border-t-transparent dark:border-brand-accent dark:border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium text-neutral-600 dark:text-slate-400">{message}</p>
    </div>
  );
}

/** Empty state with optional primary / secondary recovery actions. */
export function ScreenEmpty({ title, description, primaryAction, secondaryAction, className = "" }) {
  return (
    <div
      className={cn(
        UI_KIT.surfaceRaised,
        "flex flex-col items-center justify-center border-dashed px-4 py-10 text-center md:px-6 md:py-14",
        className,
      )}
    >
      <p className="text-base font-semibold text-neutral-900 dark:text-slate-100 md:text-lg">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral-600 dark:text-slate-400 md:text-sm">{description}</p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
          {primaryAction ? (
            <Button type="button" variant="primary" className="w-full sm:w-auto" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Error state with retry and optional secondary recovery (e.g. go back / browse). */
export function ScreenError({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  className = "",
}) {
  return (
    <div className={cn("app-alert-error flex flex-col gap-3 text-left", className)} role="alert">
      <div>
        <p className="font-semibold text-rose-900 dark:text-rose-50">{title}</p>
        {message ? <p className="mt-1 text-sm text-rose-800 dark:text-rose-100">{message}</p> : null}
      </div>
      {onRetry || secondaryAction ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {onRetry ? (
            <Button type="button" variant="primary" size="compact" className="w-full min-h-11 sm:w-auto" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button type="button" variant="secondary" size="compact" className="w-full min-h-11 sm:w-auto" onClick={secondaryAction.onClick}>
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
    <div className={cn(UI_KIT.stateSuccess, "rounded-xl border px-3 py-2 text-sm", className)} role="status">
      {children}
    </div>
  );
}
