import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  success: "badge-success",
  sale: "badge-sale",
  neutral: "badge-neutral",
  primary: "badge-primary",
};

/**
 * Static label chips (`size="default"`).
 * `size="touch"` — 44px min height + comfortable padding for filter chips / pill controls (variant colors preserved).
 */
export function Badge({ variant = "neutral", size = "default", className, ...props }) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.neutral;
  const touch =
    size === "touch"
      ? "!min-h-[var(--ui-touch-target)] touch-manipulation items-center justify-center !px-4 !py-0 !text-sm leading-snug"
      : "";
  return <span className={cn("inline-flex", base, touch, className)} {...props} />;
}
