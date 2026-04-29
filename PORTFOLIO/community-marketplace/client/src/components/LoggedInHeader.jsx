import { useCallback, useEffect, useRef, useState } from "react";
import { LinkMartLogo } from "./media/LinkMartLogo.jsx";
import { VIEWS } from "../views.js";

function ChevronDownIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SunIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function MessagesIcon({ filled = false, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function NotificationsIcon({ filled = false, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function HeartIcon({ filled = false, className = "", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function MenuUserIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MenuStoreIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function MenuSettingsIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function MenuInfoIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function MenuFileIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

function MenuLogOutIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

/** Drawer / menu trigger — 24×24 glyph inside 44px touch target */
function MenuHamburgerIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function MenuOrdersIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function MenuCartIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
      <polyline points="7.5 19.79 7.5 14.6 3 12" />
      <polyline points="21 12 16.5 14.6 16.5 19.79" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" x2="12" y1="22.08" y2="12" />
    </svg>
  );
}

/** Mobile secondary nav — four distinct glyphs (not isometric cubes): Store, ShoppingCart, Truck, Tag */

function MobileNavShopIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

function MobileNavCartIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

/** Incoming orders / deliveries — truck silhouette (not a box or cart) */
function MobileNavBuyingIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

/** Listings & sales — price tag (not a receipt or cube) */
function MobileNavSellingIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.434 0l6.294-6.294a2 2 0 0 0 0-2.828l-8.704-8.702z" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const accountMenuItemBase =
  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 outline-none transition-colors motion-reduce:transition-none hover:bg-neutral-100/90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary dark:text-slate-200 dark:hover:bg-slate-800/90 dark:focus-visible:ring-brand-accent";

const accountMenuIconWrap =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-neutral-50 text-neutral-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400";

const accountMenuIconWrapDanger =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400";

/** Mobile: borderless ghost controls (shell already frames the bar). md+: bordered pills like desktop chrome. */
const headerUtilityButtonBase =
  "relative inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent text-neutral-700 transition motion-reduce:transition-none hover:bg-neutral-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:bg-neutral-100/70 dark:text-slate-200 dark:hover:bg-slate-800/85 dark:focus-visible:ring-brand-accent/35 dark:focus-visible:ring-offset-slate-950 md:h-10 md:w-10 md:border md:border-neutral-200/75 md:bg-white md:hover:border-neutral-300 md:hover:bg-neutral-50/90 md:active:bg-white dark:md:border-slate-600/90 dark:md:bg-slate-900 dark:md:hover:border-slate-500 dark:md:hover:bg-slate-800";

/** Mobile: flat teal tint only (no ring). md+: bordered pill matches desktop chrome. */
const headerUtilityButtonActive =
  "bg-brand-soft/95 text-brand-primary dark:bg-slate-800 dark:text-brand-accent md:border-primary/35 md:bg-primary-soft/80 md:text-primary md:ring-1 md:ring-primary/20 md:dark:border-brand-accent/40 md:dark:ring-brand-accent/18";

/** Desktop pills for Marketplace vs Cart — shop flow inside the shop segment. */
function navPillShop(active, role) {
  const layout =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold transition duration-200 ease-in-out md:px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f5] dark:focus-visible:ring-offset-slate-900";
  if (!active) {
    return `${layout} text-text-primary/80 hover:bg-primary-soft/55 hover:text-text-primary focus-visible:ring-primary/35 dark:text-slate-400 dark:hover:bg-slate-700/85 dark:hover:text-slate-100 dark:focus-visible:ring-primary/30`;
  }
  return `${layout} bg-primary-soft text-primary shadow-sm ring-1 ring-primary/35 focus-visible:ring-primary/35 dark:bg-slate-900 dark:text-slate-100 dark:ring-primary/45`;
}

/** Desktop pills for Buying vs Selling — distinct active colors inside the trade group. */
function navPillTrade(active, role) {
  const layout =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold transition duration-200 ease-in-out md:px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f4f5] dark:focus-visible:ring-primary/35 dark:focus-visible:ring-offset-slate-900";
  if (!active) {
    return `${layout} text-text-primary/80 hover:bg-primary-soft/55 hover:text-text-primary dark:text-slate-400 dark:hover:bg-slate-700/85 dark:hover:text-slate-100`;
  }
  return `${layout} bg-primary-soft text-primary shadow-sm ring-1 ring-primary/35 dark:bg-slate-900 dark:text-slate-100 dark:ring-primary/45`;
}

/** Mobile secondary nav: 44px targets; active = teal wash + bar (no heavy borders). */
function mobileIconTabClass(active) {
  const base =
    "relative flex min-h-[44px] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-xl px-0.5 py-1 transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/35 dark:focus-visible:ring-brand-accent/35";
  if (!active) {
    return `${base} text-neutral-600 hover:bg-neutral-50/90 hover:text-neutral-900 dark:text-slate-500 dark:hover:bg-slate-800/70 dark:hover:text-slate-100`;
  }
  return `${base} bg-brand-soft text-brand-primary shadow-[inset_0_-2px_0_0_rgba(13,148,136,0.35)] after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:h-[3px] after:w-[48%] after:max-w-[3.25rem] after:-translate-x-1/2 after:rounded-full after:bg-brand-primary dark:bg-teal-950/40 dark:text-brand-accent dark:shadow-[inset_0_-2px_0_0_rgba(45,212,191,0.35)] dark:after:bg-brand-accent`;
}

/** Icon-only strip: names stay for screen readers (buttons also set aria-label). */
function MobileNavTabLabel({ children }) {
  return <span className="sr-only">{children}</span>;
}

const mobileNavBadgeBase =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full px-1 py-px text-[9px] font-bold leading-none shadow-sm";

const mobileSheetMenuItem = `${accountMenuItemBase} min-h-[44px] items-center rounded-xl py-3`;

/** Drawer rows: teal glyph, no boxed icon chip (mobile visual reference = Upload Product). */
const mobileDrawerIconPlain =
  "flex h-10 w-10 shrink-0 items-center justify-center text-brand-primary dark:text-brand-accent";

function ThemeToggleGroup({ theme, setTheme }) {
  return (
    <div className="flex w-full rounded-lg bg-neutral-100 p-0.5 dark:bg-slate-800" role="group" aria-label="Theme">
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset dark:focus-visible:ring-brand-accent ${
          theme === "light"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-700 dark:text-white"
            : "text-neutral-600 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        onClick={() => setTheme("light")}
      >
        <SunIcon />
        Light
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset dark:focus-visible:ring-brand-accent ${
          theme === "dark"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-700 dark:text-white"
            : "text-neutral-600 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        onClick={() => setTheme("dark")}
      >
        <MoonIcon />
        Dark
      </button>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object | null} props.user
 * @param {string} props.activeView
 * @param {(v: string) => void} props.setActiveView
 * @param {() => void} [props.goOwnProfile]
 * @param {() => void} props.goBrowse
 * @param {() => void} props.goOrders
 * @param {() => void} props.goMyPurchases
 * @param {() => void} props.goCart
 * @param {number} [props.inboxBadgeCount] Badge total for messages icon (messages + orders attention + notifications)
 * @param {"light"|"dark"} props.theme
 * @param {(t: "light"|"dark") => void} props.setTheme
 * @param {() => void} props.onLogout
 * @param {(u: object) => string} props.getDisplayNameFromUser
 * @param {number} [props.cartItemCount] Unseen cart badge count
 * @param {number} [props.totalCartCount] Total cart line-item count
 * @param {number} [props.purchasesItemCount] Recent purchases badge count
 * @param {number} [props.totalPurchasesCount] Total buyer orders count
 * @param {number} [props.ordersItemCount] Seller orders tab / new-order badge count
 * @param {number} [props.totalOrdersCount] Total seller orders count
 * @param {number} [props.notificationUnreadCount] Unread notification badge count
 * @param {number} [props.favoriteCount] Saved favorites count (shop / community product hearts)
 * @param {() => void} [props.onNavigateHome] Clear SPA path (e.g. /l/…) when opening marketplace from the logo
 * @param {import('react').ReactNode} [props.children] Main scroll region (placed between header and mobile bottom nav)
 * @param {import('react').ReactNode} [props.mobileSecondaryNav] Optional strip below the top header (mobile only)
 */
export function LoggedInHeader({
  user,
  activeView,
  setActiveView,
  goOwnProfile = () => {},
  goBrowse = () => {},
  goOrders = () => {},
  goMyPurchases = () => {},
  goCart = () => {},
  inboxBadgeCount = 0,
  theme,
  setTheme,
  onLogout,
  getDisplayNameFromUser,
  cartItemCount = 0,
  totalCartCount = 0,
  purchasesItemCount = 0,
  totalPurchasesCount = 0,
  ordersItemCount = 0,
  totalOrdersCount = 0,
  notificationUnreadCount = 0,
  favoriteCount = 0,
  onNavigateHome,
  mobileSecondaryNav = null,
  children,
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [desktopSettingsOpen, setDesktopSettingsOpen] = useState(false);

  const accountMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const mobileMenuPanelRef = useRef(null);
  const mobileDrawerFirstFocusRef = useRef(null);
  const mobileSheetCloseTimerRef = useRef(null);
  const [mobileSheetEntered, setMobileSheetEntered] = useState(false);
  /** Horizontal drag offset (≤0); 0 = fully open. Mobile swipe-to-dismiss. */
  const [drawerPullPx, setDrawerPullPx] = useState(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState(false);
  const drawerTouchRef = useRef({
    startX: 0,
    startY: 0,
    axis: /** @type {'none'|'h'|'v'} */ ("none"),
    width: 320,
  });
  const swipeCloseAfterTransitionRef = useRef(false);

  const closeAllMenus = useCallback(() => {
    setAccountMenuOpen(false);
    if (mobileSheetCloseTimerRef.current) {
      clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setMobileMenuOpen(false);
    setMobileSettingsOpen(false);
    setDesktopSettingsOpen(false);
  }, []);

  const goMarketplaceRoot = useCallback(() => {
    goBrowse();
    onNavigateHome?.();
    closeAllMenus();
  }, [goBrowse, onNavigateHome, closeAllMenus]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileSheetEntered(false);
      setDrawerPullPx(0);
      setIsDrawerDragging(false);
      swipeCloseAfterTransitionRef.current = false;
      if (mobileSheetCloseTimerRef.current) {
        clearTimeout(mobileSheetCloseTimerRef.current);
        mobileSheetCloseTimerRef.current = null;
      }
      return undefined;
    }
    if (mobileSheetCloseTimerRef.current) {
      clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setMobileSheetEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileSheetEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [mobileMenuOpen]);

  const finalizeMobileSheetClose = useCallback(() => {
    if (mobileSheetCloseTimerRef.current) {
      clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setMobileMenuOpen(false);
    setMobileSettingsOpen(false);
  }, []);

  const closeMobileSheetAnimated = useCallback(() => {
    setDrawerPullPx(0);
    setIsDrawerDragging(false);
    swipeCloseAfterTransitionRef.current = false;
    if (!mobileSheetEntered) {
      finalizeMobileSheetClose();
      return;
    }
    setMobileSheetEntered(false);
    mobileSheetCloseTimerRef.current = window.setTimeout(finalizeMobileSheetClose, 320);
  }, [mobileSheetEntered, finalizeMobileSheetClose]);

  const handleMobileDrawerTransitionEnd = useCallback(
    (event) => {
      if (event.target !== mobileMenuPanelRef.current) return;
      if (event.propertyName !== "transform") return;
      if (swipeCloseAfterTransitionRef.current) {
        swipeCloseAfterTransitionRef.current = false;
        setDrawerPullPx(0);
        finalizeMobileSheetClose();
        return;
      }
      if (mobileMenuOpen && !mobileSheetEntered) finalizeMobileSheetClose();
    },
    [mobileMenuOpen, mobileSheetEntered, finalizeMobileSheetClose],
  );

  const onDrawerTouchStart = useCallback((e) => {
    if (e.touches.length !== 1 || !mobileSheetEntered) return;
    const t = e.touches[0];
    const w = mobileMenuPanelRef.current?.offsetWidth ?? 320;
    drawerTouchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      axis: "none",
      width: w,
    };
  }, [mobileSheetEntered]);

  const onDrawerTouchMove = useCallback(
    (e) => {
      if (e.touches.length !== 1 || !mobileSheetEntered) return;
      const t = e.touches[0];
      const { startX, startY, axis, width } = drawerTouchRef.current;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      let nextAxis = axis;
      if (nextAxis === "none") {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) nextAxis = "h";
        else if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) nextAxis = "v";
      }
      drawerTouchRef.current.axis = nextAxis;
      if (nextAxis !== "h") return;
      if (e.cancelable) e.preventDefault();
      setIsDrawerDragging(true);
      const pull = Math.min(0, Math.max(-width, dx));
      setDrawerPullPx(pull);
    },
    [mobileSheetEntered],
  );

  const onDrawerTouchEnd = useCallback(() => {
    if (!mobileSheetEntered) return;
    const { axis, width } = drawerTouchRef.current;
    drawerTouchRef.current.axis = "none";
    setIsDrawerDragging(false);
    if (axis !== "h") return;
    setDrawerPullPx((pull) => {
      const w = width || mobileMenuPanelRef.current?.offsetWidth || 300;
      if (pull <= -w * 0.22) {
        swipeCloseAfterTransitionRef.current = true;
        return -w;
      }
      return 0;
    });
  }, [mobileSheetEntered]);

  useEffect(() => {
    if (!mobileMenuOpen || !mobileSheetEntered) return undefined;
    const trigger = mobileMenuButtonRef.current;
    const first = mobileDrawerFirstFocusRef.current;
    requestAnimationFrame(() => {
      first?.focus({ preventScroll: true });
    });
    return () => {
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen, mobileSheetEntered]);

  useEffect(() => {
    if (!accountMenuOpen && !mobileMenuOpen) return undefined;
    const onPointerDown = (event) => {
      const t = event.target;
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(t)) {
        setAccountMenuOpen(false);
        setDesktopSettingsOpen(false);
        setMobileSettingsOpen(false);
      }
      if (mobileMenuOpen) {
        const inBtn = mobileMenuButtonRef.current?.contains(t);
        const inPanel = mobileMenuPanelRef.current?.contains(t);
        if (!inBtn && !inPanel) closeMobileSheetAnimated();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeAllMenus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen, mobileMenuOpen, closeMobileSheetAnimated, closeAllMenus]);

  const openAccount = () => {
    setDesktopSettingsOpen(false);
    setAccountMenuOpen((o) => !o);
  };

  const browsePillActive =
    activeView === VIEWS.BROWSE ||
    activeView === VIEWS.COMMUNITY_SHOP ||
    activeView === VIEWS.FAVORITES;

  /** Mobile Shop tab — marketplace feed (excludes Favorites; hearts live in the top bar). */
  const mobileShopTabActive =
    activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP;

  const mobileSellingTabActive =
    activeView === VIEWS.ORDERS ||
    activeView === VIEWS.SELLER ||
    activeView === VIEWS.MY_LISTINGS;

  const drawerUsesPullTransform =
    mobileSheetEntered && (isDrawerDragging || drawerPullPx !== 0);

  useEffect(() => {
    const el = mobileMenuPanelRef.current;
    if (!el || !mobileMenuOpen || !mobileSheetEntered) return undefined;
    const blockVerticalScrollChaining = (ev) => {
      if (drawerTouchRef.current.axis === "h" && ev.cancelable) ev.preventDefault();
    };
    el.addEventListener("touchmove", blockVerticalScrollChaining, { passive: false });
    return () => el.removeEventListener("touchmove", blockVerticalScrollChaining);
  }, [mobileMenuOpen, mobileSheetEntered]);

  return (
    /* Mobile: column (header → main). md+: `contents` flattens into App shell so sticky header + scroll work without an extra nested flex wrapper. */
    <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden md:contents">
    <header className="mobile-app-top-header sticky top-0 z-50 shrink-0 pt-[env(safe-area-inset-top,0px)] md:sticky md:top-0 border-b border-neutral-200/40 bg-white/95 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95 md:shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="md:hidden shrink-0">
        <div className="app-shell-content-inset flex h-[4.25rem] w-full max-w-full items-center gap-2">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            className={`${headerUtilityButtonBase} h-11 w-11 shrink-0`}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu-panel"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <MenuHamburgerIcon />
          </button>
          <button
            type="button"
            className="min-w-0 shrink rounded-xl px-0.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
            onClick={goMarketplaceRoot}
            aria-label="Go to marketplace"
          >
            <LinkMartLogo className="h-8 w-auto max-w-[min(46vw,10rem)] shrink-0 object-contain" />
          </button>
          <span className="min-w-[2px] flex-1" aria-hidden />
          <button
            type="button"
            className={`${headerUtilityButtonBase} relative h-11 w-11 shrink-0 ${activeView === VIEWS.FAVORITES ? headerUtilityButtonActive : ""}`}
            aria-label={
              favoriteCount > 0
                ? `Favorites, ${favoriteCount > 99 ? "99 plus" : favoriteCount} saved`
                : "Favorites"
            }
            title={favoriteCount > 0 ? `${favoriteCount > 99 ? "99+" : favoriteCount} saved` : "Saved listings"}
            onClick={() => {
              setActiveView(VIEWS.FAVORITES);
              closeAllMenus();
            }}
          >
            <HeartIcon
              filled={activeView === VIEWS.FAVORITES}
              className={activeView === VIEWS.FAVORITES ? "text-primary dark:text-brand-accent" : ""}
            />
            {favoriteCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                {favoriteCount > 99 ? "99+" : favoriteCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${headerUtilityButtonBase} relative h-11 w-11 shrink-0 ${activeView === VIEWS.MESSAGES ? headerUtilityButtonActive : ""}`}
            aria-label={
              inboxBadgeCount > 0
                ? `Messages, ${inboxBadgeCount > 99 ? "99 plus" : inboxBadgeCount} unread or updates`
                : "Messages"
            }
            onClick={() => {
              setActiveView(VIEWS.MESSAGES);
              closeAllMenus();
            }}
          >
            <MessagesIcon
              filled={activeView === VIEWS.MESSAGES}
              className={activeView === VIEWS.MESSAGES ? "text-primary dark:text-brand-accent" : ""}
            />
            {inboxBadgeCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm">
                {inboxBadgeCount > 99 ? "99+" : inboxBadgeCount}
              </span>
            ) : null}
          </button>
        </div>

        <nav className="mobile-app-secondary-nav" role="navigation" aria-label="Primary">
          <div
            className="app-shell-content-inset flex min-h-0 w-full max-w-full items-stretch gap-0.5 py-1.5 min-[360px]:gap-1 min-[390px]:gap-1.5 min-[430px]:gap-2"
            role="tablist"
            aria-label="Shop, cart, buying, selling, profile"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileShopTabActive}
              aria-current={mobileShopTabActive ? "page" : undefined}
              className={mobileIconTabClass(mobileShopTabActive)}
              aria-label="Shop"
              onClick={() => {
                setAccountMenuOpen(false);
                setDesktopSettingsOpen(false);
                goBrowse();
                closeAllMenus();
              }}
            >
              <MobileNavShopIcon className="h-[22px] w-[22px] shrink-0" aria-hidden />
              <MobileNavTabLabel>Shop</MobileNavTabLabel>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === VIEWS.CART}
              aria-current={activeView === VIEWS.CART ? "page" : undefined}
              className={mobileIconTabClass(activeView === VIEWS.CART)}
              aria-label={
                cartItemCount > 0
                  ? `Cart, ${cartItemCount > 99 ? "99 plus" : cartItemCount} new`
                  : totalCartCount > 0
                    ? `Cart, ${totalCartCount > 99 ? "99 plus" : totalCartCount} items`
                    : "Cart"
              }
              onClick={() => {
                goCart();
                closeAllMenus();
              }}
            >
              <span className="relative inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center">
                <MobileNavCartIcon className="h-[22px] w-[22px] shrink-0" aria-hidden />
                {cartItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-amber-600 text-white dark:bg-amber-500`}>
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : totalCartCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-neutral-500 text-white dark:bg-slate-600`} aria-hidden>
                    {totalCartCount > 99 ? "99+" : totalCartCount}
                  </span>
                ) : null}
              </span>
              <MobileNavTabLabel>Cart</MobileNavTabLabel>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === VIEWS.MY_PURCHASES}
              aria-current={activeView === VIEWS.MY_PURCHASES ? "page" : undefined}
              className={mobileIconTabClass(activeView === VIEWS.MY_PURCHASES)}
              aria-label={
                purchasesItemCount > 0
                  ? `Buying, ${purchasesItemCount > 99 ? "99 plus" : purchasesItemCount} updates`
                  : "Buying"
              }
              onClick={() => {
                goMyPurchases();
                closeAllMenus();
              }}
            >
              <span className="relative inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center">
                <MobileNavBuyingIcon className="h-[22px] w-[22px] shrink-0" aria-hidden />
                {purchasesItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-sky-600 text-white dark:bg-sky-500`}>
                    {purchasesItemCount > 99 ? "99+" : purchasesItemCount}
                  </span>
                ) : null}
              </span>
              <MobileNavTabLabel>Buying</MobileNavTabLabel>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileSellingTabActive}
              aria-current={mobileSellingTabActive ? "page" : undefined}
              className={mobileIconTabClass(mobileSellingTabActive)}
              aria-label={
                ordersItemCount > 0
                  ? `Selling, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} alerts`
                  : "Selling"
              }
              onClick={() => {
                goOrders();
                closeAllMenus();
              }}
            >
              <span className="relative inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center">
                <MobileNavSellingIcon className="h-[22px] w-[22px] shrink-0" aria-hidden />
                {ordersItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-emerald-600 text-white dark:bg-emerald-500`}>
                    {ordersItemCount > 99 ? "99+" : ordersItemCount}
                  </span>
                ) : null}
              </span>
              <MobileNavTabLabel>Selling</MobileNavTabLabel>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === VIEWS.PROFILE}
              aria-current={activeView === VIEWS.PROFILE ? "page" : undefined}
              className={mobileIconTabClass(activeView === VIEWS.PROFILE)}
              aria-label="Profile"
              onClick={() => {
                goOwnProfile();
                closeAllMenus();
              }}
            >
              <MenuUserIcon className="h-[22px] w-[22px] shrink-0" width={22} height={22} aria-hidden />
              <MobileNavTabLabel>Profile</MobileNavTabLabel>
            </button>
          </div>
        </nav>

        {mobileSecondaryNav ? (
          <div className="border-t border-neutral-200/80 bg-white/95 py-2 dark:border-slate-700 dark:bg-slate-900/95">
            <div className="app-shell-content-inset">{mobileSecondaryNav}</div>
          </div>
        ) : null}
      </div>

      <div className="app-container hidden md:flex h-[4.25rem] items-center justify-between gap-2 md:gap-3">
        <button
          type="button"
          className="rounded-xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent dark:focus-visible:ring-offset-slate-950"
          onClick={goMarketplaceRoot}
          aria-label="Go to marketplace"
        >
          <LinkMartLogo className="h-9 w-auto max-w-full shrink-0 object-contain md:h-10 md:max-w-[min(10.5rem,100%)]" />
        </button>

        <div className="hidden min-w-0 flex-1 items-center justify-center overflow-x-auto md:flex">
          <nav className="flex min-w-0 max-w-full items-center justify-center" aria-label="Main">
            <div
              className="flex max-w-full shrink-0 items-center gap-0.5 rounded-full p-0.5"
              role="group"
              aria-label="Shop, cart, buying, and selling"
            >
              <button
                type="button"
                className={navPillShop(browsePillActive, "browse")}
                aria-label="Shop"
                title="Browse listings"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setDesktopSettingsOpen(false);
                  goBrowse();
                  closeAllMenus();
                }}
              >
                <MenuStoreIcon
                  className={`h-[18px] w-[18px] shrink-0 ${browsePillActive ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[5.5rem] truncate md:max-w-none">Shop</span>
              </button>
              <button
                type="button"
                className={navPillShop(activeView === VIEWS.CART, "cart")}
                aria-label={
                  cartItemCount > 0
                    ? `Cart, ${cartItemCount > 99 ? "99 plus" : cartItemCount} new item${cartItemCount === 1 ? "" : "s"}`
                    : totalCartCount > 0
                      ? `Cart, ${totalCartCount > 99 ? "99 plus" : totalCartCount} item${totalCartCount === 1 ? "" : "s"}`
                      : "Shopping cart"
                }
                title="Review items before checkout"
                onClick={() => {
                  goCart();
                  closeAllMenus();
                }}
              >
                <MenuCartIcon
                  className={`h-[18px] w-[18px] shrink-0 ${activeView === VIEWS.CART ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[7rem] truncate md:max-w-none">Cart</span>
                {cartItemCount > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-amber-500">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : totalCartCount > 0 ? (
                  <span className="ml-1 text-[11px] font-semibold leading-none text-neutral-500 dark:text-slate-400">
                    {totalCartCount > 99 ? "99+" : totalCartCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={navPillTrade(activeView === VIEWS.MY_PURCHASES, "buy")}
                aria-label={
                  purchasesItemCount > 0
                    ? `Buying, ${purchasesItemCount > 99 ? "99 plus" : purchasesItemCount} updates`
                    : totalPurchasesCount > 0
                      ? `Buying, ${totalPurchasesCount > 99 ? "99 plus" : totalPurchasesCount} order${totalPurchasesCount === 1 ? "" : "s"}`
                      : "Buying — things you purchased"
                }
                title="Things you bought — track status, pickup, and COD"
                onClick={() => {
                  goMyPurchases();
                  closeAllMenus();
                }}
              >
                <MenuFileIcon
                  className={`h-[18px] w-[18px] shrink-0 ${activeView === VIEWS.MY_PURCHASES ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[5.5rem] truncate md:max-w-none">Buying</span>
                {purchasesItemCount > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-sky-500">
                    {purchasesItemCount > 99 ? "99+" : purchasesItemCount}
                  </span>
                ) : totalPurchasesCount > 0 ? (
                  <span className="ml-1 text-[11px] font-semibold leading-none text-neutral-500 dark:text-slate-400">
                    {totalPurchasesCount > 99 ? "99+" : totalPurchasesCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={navPillTrade(activeView === VIEWS.ORDERS, "sell")}
                aria-label={
                  ordersItemCount > 0
                    ? `Selling, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} buyer order alerts`
                    : totalOrdersCount > 0
                      ? `Selling, ${totalOrdersCount > 99 ? "99 plus" : totalOrdersCount} order${totalOrdersCount === 1 ? "" : "s"}`
                      : "Selling — orders from your buyers"
                }
                title={
                  ordersItemCount > 0
                    ? `${ordersItemCount > 99 ? "99+" : ordersItemCount} pending or updated buyer order${ordersItemCount === 1 ? "" : "s"}`
                    : totalOrdersCount > 0
                      ? `${totalOrdersCount > 99 ? "99+" : totalOrdersCount} total buyer order${totalOrdersCount === 1 ? "" : "s"}`
                      : "Orders people placed with you"
                }
                onClick={() => {
                  goOrders();
                  closeAllMenus();
                }}
              >
                <MenuOrdersIcon
                  className={`h-[18px] w-[18px] shrink-0 ${activeView === VIEWS.ORDERS ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[5.5rem] truncate md:max-w-none">Selling</span>
                {ordersItemCount > 0 ? (
                  <span
                    className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-emerald-500"
                    aria-hidden
                  >
                    {ordersItemCount > 99 ? "99+" : ordersItemCount}
                  </span>
                ) : totalOrdersCount > 0 ? (
                  <span className="ml-1 text-[11px] font-semibold leading-none text-neutral-500 dark:text-slate-400">
                    {totalOrdersCount > 99 ? "99+" : totalOrdersCount}
                  </span>
                ) : null}
              </button>
            </div>
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`${headerUtilityButtonBase} ${activeView === VIEWS.MESSAGES ? headerUtilityButtonActive : ""}`}
              aria-label="Messages"
              onClick={() => {
                setActiveView(VIEWS.MESSAGES);
                closeAllMenus();
              }}
            >
              <MessagesIcon
                filled={activeView === VIEWS.MESSAGES}
                className={activeView === VIEWS.MESSAGES ? "text-emerald-600 dark:text-emerald-300" : ""}
              />
            </button>
            <button
              type="button"
              className={`${headerUtilityButtonBase} ${activeView === VIEWS.NOTIFICATIONS ? headerUtilityButtonActive : ""}`}
              aria-label="Notifications"
              onClick={() => {
                setActiveView(VIEWS.NOTIFICATIONS);
                closeAllMenus();
              }}
            >
              <NotificationsIcon
                filled={activeView === VIEWS.NOTIFICATIONS}
                className={activeView === VIEWS.NOTIFICATIONS ? "text-emerald-600 dark:text-emerald-300" : ""}
              />
              {notificationUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm">
                  {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`${headerUtilityButtonBase} ${activeView === VIEWS.FAVORITES ? headerUtilityButtonActive : ""}`}
              aria-label={
                favoriteCount > 0
                  ? `My Favorites, ${favoriteCount > 99 ? "99 plus" : favoriteCount} saved`
                  : "My Favorites"
              }
              title={favoriteCount > 0 ? `${favoriteCount > 99 ? "99+" : favoriteCount} saved listings` : "Saved listings"}
              onClick={() => {
                setActiveView(VIEWS.FAVORITES);
                closeAllMenus();
              }}
            >
              <HeartIcon
                filled={activeView === VIEWS.FAVORITES}
                className={activeView === VIEWS.FAVORITES ? "text-emerald-600 dark:text-emerald-300" : ""}
              />
              {favoriteCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                  {favoriteCount > 99 ? "99+" : favoriteCount}
                </span>
              ) : null}
            </button>
          </div>
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-white text-neutral-700 shadow-sm transition hover:-translate-y-px hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${
                activeView === VIEWS.PROFILE
                  ? "border-primary/55 ring-2 ring-primary/25 hover:border-primary/65 dark:border-brand-accent/55 dark:ring-brand-accent/20"
                  : "border-neutral-200/90 hover:border-neutral-300 dark:border-slate-600 dark:hover:border-slate-500"
              } ${accountMenuOpen ? headerUtilityButtonActive : ""}`}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label={activeView === VIEWS.PROFILE ? "Account menu (viewing profile)" : "Account menu"}
              onClick={openAccount}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand-primary">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    sizes="32px"
                  />
                ) : (
                  (String(user?.username || "").trim().charAt(0) || "?").toUpperCase()
                )}
              </span>
            </button>
            {accountMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 min-w-0 w-[min(100vw-1.5rem,18.5rem)] overflow-visible rounded-xl border border-neutral-200/90 bg-white p-1 shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.2)] md:min-w-[17rem]"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={accountMenuItemBase}
                  onClick={() => {
                    goOwnProfile();
                    closeAllMenus();
                  }}
                >
                  <span className={accountMenuIconWrap} aria-hidden>
                    <MenuUserIcon />
                  </span>
                  Profile
                </button>
                <div role="none" className="mx-1 my-1.5 border-t border-neutral-200/90 dark:border-slate-700/90" />
                <div className="relative">
                  <button
                    type="button"
                    role="menuitem"
                    className={`${accountMenuItemBase} justify-between gap-2`}
                    aria-expanded={desktopSettingsOpen}
                    aria-controls="account-settings-panel"
                    onClick={() => setDesktopSettingsOpen((v) => !v)}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={accountMenuIconWrap} aria-hidden>
                        <MenuSettingsIcon />
                      </span>
                      Settings
                    </span>
                    <ChevronDownIcon
                      className={`h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform dark:text-slate-500 ${desktopSettingsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {desktopSettingsOpen ? (
                    <div
                      id="account-settings-panel"
                      role="region"
                      className="mx-0.5 mb-1 rounded-xl border border-neutral-200/90 bg-neutral-50/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-800/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    >
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Theme</p>
                      <ThemeToggleGroup theme={theme} setTheme={setTheme} />
                      <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Preferences</p>
                      <p className="text-xs text-neutral-500 dark:text-slate-400">Notification controls will appear here.</p>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className={accountMenuItemBase}
                  onClick={() => {
                    setActiveView(VIEWS.ABOUT);
                    closeAllMenus();
                  }}
                >
                  <span className={accountMenuIconWrap} aria-hidden>
                    <MenuInfoIcon />
                  </span>
                  About
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={accountMenuItemBase}
                  onClick={() => {
                    setActiveView(VIEWS.TERMS);
                    closeAllMenus();
                  }}
                >
                  <span className={accountMenuIconWrap} aria-hidden>
                    <MenuFileIcon />
                  </span>
                  Terms & Conditions
                </button>
                <div role="none" className="mx-1 my-1.5 border-t border-neutral-200/90 dark:border-slate-700/90" />
                <button
                  type="button"
                  role="menuitem"
                  className={`${accountMenuItemBase} font-medium text-rose-700 hover:bg-rose-50/90 dark:text-rose-400 dark:hover:bg-rose-950/45`}
                  onClick={() => {
                    onLogout();
                    closeAllMenus();
                  }}
                >
                  <span className={accountMenuIconWrapDanger} aria-hidden>
                    <MenuLogOutIcon />
                  </span>
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>

      {mobileMenuOpen ? (
        <>
          {/* Semi-transparent overlay — closes drawer on tap (full viewport, behind drawer z-order) */}
          <button
            type="button"
            className={`fixed inset-0 z-[60] bg-slate-900/55 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none md:hidden ${
              mobileSheetEntered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Close menu"
            tabIndex={-1}
            onClick={closeMobileSheetAnimated}
          />
          <div
            ref={mobileMenuPanelRef}
            id="mobile-nav-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Account menu"
            onTouchStart={onDrawerTouchStart}
            onTouchMove={onDrawerTouchMove}
            onTouchEnd={onDrawerTouchEnd}
            onTouchCancel={() => {
              setIsDrawerDragging(false);
              drawerTouchRef.current.axis = "none";
              setDrawerPullPx(0);
            }}
            onTransitionEnd={handleMobileDrawerTransitionEnd}
            style={
              drawerUsesPullTransform
                ? {
                    transform: `translate3d(${drawerPullPx}px, 0, 0)`,
                    transition: isDrawerDragging ? "none" : "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  }
                : undefined
            }
            className={`fixed inset-y-0 left-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-[82vw] max-w-[22rem] touch-pan-y flex-col overflow-hidden border-r border-neutral-200/35 bg-white shadow-[4px_0_20px_-10px_rgba(15,23,42,0.1)] motion-reduce:transform-none dark:border-slate-700/45 dark:bg-slate-900 dark:shadow-[4px_0_24px_-8px_rgba(0,0,0,0.4)] md:hidden ${
              drawerUsesPullTransform
                ? ""
                : mobileSheetEntered
                  ? "translate-x-0 transition-transform duration-300 ease-out motion-reduce:duration-75 motion-reduce:transition-none"
                  : "-translate-x-full pointer-events-none transition-transform duration-300 ease-out motion-reduce:duration-75 motion-reduce:transition-none"
            } pl-[env(safe-area-inset-left,0px)]`}
          >
            <nav
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] [-webkit-overflow-scrolling:touch]"
              aria-label="Account"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  ref={mobileDrawerFirstFocusRef}
                  type="button"
                  className={mobileSheetMenuItem}
                  onClick={() => {
                    goOwnProfile();
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={mobileDrawerIconPlain} aria-hidden>
                    <MenuUserIcon />
                  </span>
                  Profile
                </button>
                <button
                  type="button"
                  className={`${mobileSheetMenuItem} justify-between gap-2`}
                  aria-expanded={mobileSettingsOpen}
                  aria-controls="mobile-account-settings"
                  onClick={() => setMobileSettingsOpen((v) => !v)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={mobileDrawerIconPlain} aria-hidden>
                      <MenuSettingsIcon />
                    </span>
                    Settings
                  </span>
                  <ChevronRightIcon
                    className={`h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform dark:text-slate-500 ${mobileSettingsOpen ? "rotate-90" : ""}`}
                  />
                </button>
                {mobileSettingsOpen ? (
                  <div
                    id="mobile-account-settings"
                    className="mx-0.5 mb-1 rounded-xl border border-neutral-200/50 bg-neutral-50/80 p-3 dark:border-slate-600/80 dark:bg-slate-800/60"
                  >
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Theme</p>
                    <ThemeToggleGroup theme={theme} setTheme={setTheme} />
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Preferences</p>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">Notification controls will appear here.</p>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={mobileSheetMenuItem}
                  onClick={() => {
                    setActiveView(VIEWS.ABOUT);
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={mobileDrawerIconPlain} aria-hidden>
                    <MenuInfoIcon />
                  </span>
                  About
                </button>
                <button
                  type="button"
                  className={mobileSheetMenuItem}
                  onClick={() => {
                    setActiveView(VIEWS.TERMS);
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={mobileDrawerIconPlain} aria-hidden>
                    <MenuFileIcon />
                  </span>
                  Terms and Conditions
                </button>
                <button
                  type="button"
                  className={`${mobileSheetMenuItem} mt-0.5 font-medium text-rose-700 hover:bg-rose-50/90 dark:text-rose-400 dark:hover:bg-rose-950/45`}
                  onClick={() => {
                    onLogout();
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={`${mobileDrawerIconPlain} text-rose-600 dark:text-rose-400`} aria-hidden>
                    <MenuLogOutIcon />
                  </span>
                  Log out
                </button>
              </div>
            </nav>
          </div>
        </>
      ) : null}
      {children}
    </div>
  );
}
