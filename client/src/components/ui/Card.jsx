import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const VARIANT_CLASS = {
  default: "app-card",
  interactive: "app-card-interactive",
  raised:
    "lm-card bg-gradient-to-b from-surface to-primary-soft/25 p-4 text-sm leading-relaxed shadow-none dark:from-[#0f2234] dark:to-[#11283d]/88 md:p-5 md:shadow-sm md:shadow-slate-900/[0.04] dark:md:shadow-none md:dark:border-[#1f3c56]",
  muted:
    "lm-card rounded-[var(--ui-radius)] border-neutral-200/80 bg-primary-soft/45 p-4 text-sm leading-relaxed dark:border-slate-600/70 dark:bg-[#11283d]/65 md:dark:border-[#1f3c56]",
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
