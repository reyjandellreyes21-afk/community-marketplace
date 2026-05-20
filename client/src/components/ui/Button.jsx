import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  primary: "lm-btn-primary",
  secondary: "lm-btn-secondary",
  ghost: "lm-btn-ghost",
  danger: "lm-btn-danger",
  accent: "lm-btn-accent",
};

/**
 * Mobile-friendly button — LinkMart `lm-btn*` system (`index.css`). Active scale + disabled opacity,
 * loading (`aria-busy`, `data-state`, spinner). Use `fullWidth` for stacked recovery actions on phones.
 * When `iconOnly` is set, also pass `aria-label` (or `aria-labelledby`) for screen readers.
 */
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "default",
    fullWidth,
    iconOnly,
    className,
    type = "button",
    disabled,
    loading,
    loadingLabel = "Loading…",
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...props
  },
  ref,
) {
  if (import.meta.env.DEV && iconOnly && !ariaLabel && !ariaLabelledBy) {
    console.warn("[Button] iconOnly controls need aria-label or aria-labelledby for accessibility.");
  }
  const cls = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const compact =
    size === "compact" && !iconOnly
      ? "md:min-h-0 md:h-9 md:min-w-0 md:px-3 md:py-2 md:text-sm"
      : "";
  const isDisabled = Boolean(disabled || loading);
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-busy={loading ? true : undefined}
      data-state={loading ? "loading" : isDisabled ? "disabled" : "idle"}
      className={cn(
        cls,
        compact,
        fullWidth && "w-full",
        iconOnly && "lm-btn-icon",
        isDisabled && "cursor-not-allowed opacity-55",
        loading && "pointer-events-none",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-95 motion-reduce:animate-none motion-reduce:opacity-90"
            aria-hidden
          />
          <span>{loadingLabel}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});
