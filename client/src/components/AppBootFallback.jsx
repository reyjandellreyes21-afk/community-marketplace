import { LinkMartLogo } from "./media/LinkMartLogo.jsx";
import { cn } from "../lib/cn.js";
import { MOBILE_DESIGN_SYSTEM } from "../lib/mobileUi.js";

/** Full-screen loader while the lazy `App` chunk downloads (after JS, before React app tree). */
export function AppBootFallback({ message = "Loading app…" }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-white pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] dark:bg-slate-950">
      <LinkMartLogo className="h-10 w-auto max-w-[min(72vw,14rem)] shrink-0 object-contain md:h-11" />
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center justify-center gap-3 text-center"
      >
        <span className={MOBILE_DESIGN_SYSTEM.screen.loading.spinner} aria-hidden />
        <p className={cn("max-w-mobile-baseline", MOBILE_DESIGN_SYSTEM.screen.loading.message)}>{message}</p>
      </div>
    </div>
  );
}
