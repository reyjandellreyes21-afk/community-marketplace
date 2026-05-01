import { cn } from "../lib/cn.js";

/**
 * Outer wrapper for the logged-in marketplace shell — pairs with `.mobile-app-shell` in `index.css`.
 */
export function MobileAppShell({ children, className }) {
  return <div className={cn("mobile-app-shell", className)}>{children}</div>;
}
