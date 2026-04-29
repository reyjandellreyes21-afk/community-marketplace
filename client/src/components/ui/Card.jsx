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

const PADDING_CLASS = {
  default: "",
  none: "!p-0 md:!p-0",
  sm: "!p-3 text-sm leading-relaxed md:!p-4",
};

/**
 * Content surface with shared radius (`--ui-radius-lg` on default), border, and mobile type rhythm.
 * `interactive` adds hover affordance; `raised` / `muted` match marketplace surfaces.
 * `padding` overrides inner spacing for edge-to-edge media (`none`) or tighter stacks (`sm`).
 */
export const Card = forwardRef(function Card(
  { as: Comp = "div", variant = "default", padding = "default", className, ...props },
  ref,
) {
  const base = VARIANT_CLASS[variant] || VARIANT_CLASS.default;
  const pad = PADDING_CLASS[padding] ?? PADDING_CLASS.default;
  return <Comp ref={ref} className={cn(base, pad, className)} {...props} />;
});
