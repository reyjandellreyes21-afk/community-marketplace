import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const INVALID_RING =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30";

/**
 * Single-line fields: `input-base` enforces 44px min height + `text-base` on mobile; `md:` tightens height/type.
 * Use `type` (`email` | `tel` | `number` | `search` | …), `inputMode`, and `enterKeyHint` for mobile keyboards.
 * Pair with `FormField` + `Label`. For shell-aligned width inside padded parents, use default `w-full`.
 */
export const Input = forwardRef(function Input({ className, invalid, id, ...props }, ref) {
  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid ? true : undefined}
      className={cn("input-base", invalid && INVALID_RING, className)}
      {...props}
    />
  );
});

export const Label = forwardRef(function Label({ className, ...props }, ref) {
  return <label ref={ref} className={cn("label-base", className)} {...props} />;
});
