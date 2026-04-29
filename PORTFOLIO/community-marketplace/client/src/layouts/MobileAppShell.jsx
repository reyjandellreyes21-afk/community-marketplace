/**
 * Outer wrapper for the logged-in marketplace shell — pairs with `.mobile-app-shell` in `index.css`.
 */
export function MobileAppShell({ children }) {
  return <div className="mobile-app-shell">{children}</div>;
}
