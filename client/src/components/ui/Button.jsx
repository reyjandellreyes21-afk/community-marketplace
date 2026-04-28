import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  accent: "btn-accent",
};

/** Standard button: 44px min touch height; use `size="compact"` to tighten from `md` only. */
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "default",
    className,
    type = "button",
    disabled,
    loading,
    loadingLabel = "Loading…",
    children,
    ...props
  },
  ref,
) {
  const cls = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const compact =
    size === "compact"
      ? "md:min-h-0 md:h-9 md:min-w-0 md:px-3 md:py-2 md:text-sm"
      : "";
  const isDisabled = Boolean(disabled || loading);
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      className={cn(
        cls,
        compact,
        isDisabled && "cursor-not-allowed opacity-55",
        loading && "pointer-events-none",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-95"
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
