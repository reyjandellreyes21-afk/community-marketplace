import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  default: "app-card",
  interactive: "app-card-interactive",
  raised:
    "rounded-[var(--ui-radius-lg)] border border-border bg-gradient-to-b from-surface to-primary-soft/20 p-4 text-sm leading-relaxed shadow-sm dark:border-[#1f3c56] dark:from-[#0f2234] dark:to-[#11283d]/90 md:p-5",
  muted:
    "rounded-[var(--ui-radius)] border border-border bg-primary-soft/40 p-4 text-sm leading-relaxed dark:border-[#1f3c56] dark:bg-[#11283d]/65",
};

/**
 * Content surface with shared radius, border, type rhythm.
 * `interactive` adds hover affordance; `raised` / `muted` match marketplace surfaces.
 */
export const Card = forwardRef(function Card({ as: Comp = "div", variant = "default", className, ...props }, ref) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.default;
  return <Comp ref={ref} className={cn(base, className)} {...props} />;
});
