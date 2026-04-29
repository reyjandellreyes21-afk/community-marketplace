import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const INVALID_RING =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-500/70 dark:focus:ring-rose-500/30";

/** Multi-line control: matches `input-base` focus/touch treatment with comfortable mobile min height. */
export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "textarea-base",
        invalid && INVALID_RING,
        className,
      )}
      {...props}
    />
  );
});
