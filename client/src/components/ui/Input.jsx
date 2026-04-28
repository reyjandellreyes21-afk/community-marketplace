import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const INVALID_RING =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30";

/**
 * Text-like inputs: 44px min height on small viewports (`input-base`); pass `className` to override for dense rows.
 */
export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={cn("input-base", invalid && INVALID_RING, className)} {...props} />;
});

export const Label = forwardRef(function Label({ className, ...props }, ref) {
  return <label ref={ref} className={cn("label-base", className)} {...props} />;
});
