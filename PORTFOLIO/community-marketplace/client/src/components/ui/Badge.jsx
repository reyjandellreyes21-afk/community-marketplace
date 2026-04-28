import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  success: "badge-success",
  sale: "badge-sale",
  neutral: "badge-neutral",
  primary: "badge-primary",
};

/**
 * Static label chips (`size="default"`).
 * `size="touch"` adds 44px min height + padding for tappable filter chips (still uses variant colors).
 */
export function Badge({ variant = "neutral", size = "default", className, ...props }) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.neutral;
  const touch =
    size === "touch"
      ? "min-h-[44px] touch-manipulation items-center justify-center px-4 text-sm"
      : "";
  return <span className={cn(base, touch, className)} {...props} />;
}
