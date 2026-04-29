import { cn } from "../../lib/cn.js";

/**
 * Sticky action row for long mobile forms so primary submit stays above the home indicator / keyboard.
 * Collapses to normal flow from `md` (desktop uses in-flow buttons).
 */
export function MobileFormActions({ children, className = "" }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 mt-2 w-full border-t border-neutral-200/70 bg-gradient-to-t from-white via-white to-white/96 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.06)] backdrop-blur-[2px] dark:border-slate-700/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950/98 dark:shadow-[0_-4px_28px_-8px_rgba(0,0,0,0.35)] md:static md:z-auto md:mt-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
