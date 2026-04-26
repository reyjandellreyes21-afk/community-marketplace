import { useCallback, useEffect, useRef, useState } from "react";
import navLogo from "../assets/LM-LIGHT.png";
import { VIEWS } from "../views.js";

function MenuIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden {...props}>
      <line x1="4" x2="20" y1="7" y2="7" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="17" y2="17" />
    </svg>
  );
}

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

function CloseIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
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

function MessagesIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function NotificationsIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
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

function GridIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
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

const accountMenuItemBase =
  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 outline-none transition-colors hover:bg-neutral-100/90 dark:text-slate-200 dark:hover:bg-slate-800/90";

const accountMenuIconWrap =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-neutral-50 text-neutral-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400";

const accountMenuIconWrapDanger =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400";

/** Compact item for fixed bottom main nav (mobile / tablet). */
function bottomNavItemClass(active) {
  return `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10px] font-semibold leading-tight transition sm:px-1 sm:text-[11px] ${
    active
      ? "bg-brand-soft/70 text-brand-primary dark:bg-slate-800 dark:text-slate-100"
      : "text-neutral-600 hover:bg-neutral-100/90 dark:text-slate-400 dark:hover:bg-slate-800/90"
  }`;
}

function LinkMartLogo({ className = "h-7 w-auto max-w-[11rem] shrink-0 object-contain sm:h-8 sm:max-w-[13rem]" }) {
  return <img src={navLogo} alt="LinkMart logo" className={className} />;
}

function navPill(active) {
  return `rounded-full px-2.5 py-2 text-sm font-medium transition sm:px-3 ${
    active
      ? "bg-brand-soft text-brand-primary dark:bg-slate-800 dark:text-slate-100"
      : "text-neutral-700 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;
}

function ThemeToggleGroup({ theme, setTheme }) {
  return (
    <div className="flex w-full rounded-lg bg-neutral-100 p-0.5 dark:bg-slate-800" role="group" aria-label="Theme">
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition ${
          theme === "light"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-700 dark:text-white"
            : "text-neutral-500 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-200"
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
        className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold transition ${
          theme === "dark"
            ? "bg-white text-neutral-900 shadow-sm dark:bg-slate-700 dark:text-white"
            : "text-neutral-500 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-200"
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
 * @param {() => void} props.goBrowse
 * @param {() => void} props.goOrders
 * @param {() => void} props.goMyPurchases
 * @param {() => void} props.goCart
 * @param {"light"|"dark"} props.theme
 * @param {(t: "light"|"dark") => void} props.setTheme
 * @param {() => void} props.onLogout
 * @param {(u: object) => string} props.getDisplayNameFromUser
 * @param {number} [props.cartItemCount] Total cart quantity badge count
 * @param {number} [props.purchasesItemCount] Recent purchases badge count
 * @param {number} [props.ordersItemCount] Seller orders tab / new-order badge count
 * @param {() => void} [props.onNavigateHome] Clear SPA path (e.g. /l/…) when opening marketplace from the logo
 * @param {string | null} [props.communityShopName] When set, user is in a community-scoped shop (show context + leave control)
 * @param {() => void} [props.onLeaveCommunityShop] Navigate to global marketplace (all areas)
 */
export function LoggedInHeader({
  user,
  activeView,
  setActiveView,
  goBrowse = () => {},
  goOrders = () => {},
  goMyPurchases = () => {},
  goCart = () => {},
  theme,
  setTheme,
  onLogout,
  getDisplayNameFromUser,
  cartItemCount = 0,
  purchasesItemCount = 0,
  ordersItemCount = 0,
  onNavigateHome,
  communityShopName = null,
  onLeaveCommunityShop,
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [settingsFlyoutOpen, setSettingsFlyoutOpen] = useState(false);

  const accountMenuRef = useRef(null);
  const settingsRowRef = useRef(null);
  const settingsFlyoutRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const mobileMenuPanelRef = useRef(null);
  const mobileSheetCloseRef = useRef(null);
  const mobileSheetSurfaceRef = useRef(null);
  const mobileSheetCloseTimerRef = useRef(null);

  const [mobileSheetEntered, setMobileSheetEntered] = useState(false);

  const closeAllMenus = useCallback(() => {
    setAccountMenuOpen(false);
    if (mobileSheetCloseTimerRef.current) {
      clearTimeout(mobileSheetCloseTimerRef.current);
      mobileSheetCloseTimerRef.current = null;
    }
    setMobileMenuOpen(false);
    setMobileSettingsOpen(false);
    setSettingsFlyoutOpen(false);
  }, []);

  const goMarketplaceRoot = useCallback(() => {
    goBrowse();
    onNavigateHome?.();
    closeAllMenus();
  }, [goBrowse, onNavigateHome, closeAllMenus]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileSheetEntered(false);
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
    if (!mobileSheetEntered) {
      finalizeMobileSheetClose();
      return;
    }
    setMobileSheetEntered(false);
    mobileSheetCloseTimerRef.current = window.setTimeout(finalizeMobileSheetClose, 340);
  }, [mobileSheetEntered, finalizeMobileSheetClose]);

  const handleMobileSheetTransitionEnd = useCallback(
    (event) => {
      if (event.target !== mobileSheetSurfaceRef.current) return;
      if (event.propertyName !== "transform") return;
      if (mobileMenuOpen && !mobileSheetEntered) finalizeMobileSheetClose();
    },
    [mobileMenuOpen, mobileSheetEntered, finalizeMobileSheetClose],
  );

  useEffect(() => {
    if (!mobileMenuOpen || !mobileSheetEntered) return undefined;
    const trigger = mobileMenuButtonRef.current;
    const closeBtn = mobileSheetCloseRef.current;
    closeBtn?.focus({ preventScroll: true });
    return () => {
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen, mobileSheetEntered]);

  useEffect(() => {
    if (!accountMenuOpen && !settingsFlyoutOpen && !mobileMenuOpen) return undefined;
    const onPointerDown = (event) => {
      const t = event.target;
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(t)) {
        setAccountMenuOpen(false);
        setSettingsFlyoutOpen(false);
        setMobileSettingsOpen(false);
      }
      if (settingsFlyoutOpen && settingsRowRef.current && settingsFlyoutRef.current) {
        const inRow = settingsRowRef.current.contains(t);
        const inFly = settingsFlyoutRef.current.contains(t);
        if (!inRow && !inFly) setSettingsFlyoutOpen(false);
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen, settingsFlyoutOpen, mobileMenuOpen, closeMobileSheetAnimated, closeAllMenus]);

  const openAccount = () => {
    setSettingsFlyoutOpen(false);
    setAccountMenuOpen((o) => !o);
  };

  const accountLabel = user?.username || getDisplayNameFromUser(user) || "Account";

  const browsePillActive = activeView === VIEWS.BROWSE || activeView === VIEWS.COMMUNITY_SHOP;

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
      <div className="app-container flex h-[4.25rem] items-center justify-between gap-2 sm:gap-3">
        <button type="button" className="rounded-xl px-1 py-1 focus:outline-none" onClick={goMarketplaceRoot} aria-label="Go to marketplace">
          <LinkMartLogo className="h-7 w-auto max-w-[9rem] shrink-0 object-contain sm:h-8 sm:max-w-[11rem]" />
        </button>

        {communityShopName && onLeaveCommunityShop ? (
          <div className="flex min-w-0 max-w-[min(46vw,10.5rem)] flex-1 flex-col items-stretch justify-center gap-0.5 sm:max-w-[min(14rem,32vw)] lg:max-w-[min(18rem,22vw)] lg:flex-none lg:shrink-0">
            <span
              className="truncate text-[10px] font-semibold leading-tight text-brand-primary dark:text-brand-accent sm:text-[11px]"
              title={communityShopName}
            >
              In {communityShopName}
            </span>
            <button
              type="button"
              className="truncate text-left text-[10px] font-medium text-neutral-500 underline decoration-neutral-300 underline-offset-2 transition hover:text-neutral-800 sm:text-[11px] dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200"
              onClick={() => {
                onLeaveCommunityShop();
                closeAllMenus();
              }}
            >
              All areas
            </button>
          </div>
        ) : null}

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto lg:flex lg:gap-1">
          <nav className="flex min-w-0 items-center justify-center gap-0.5 lg:gap-1" aria-label="Main">
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 ${navPill(browsePillActive)}`}
              onClick={() => {
                setAccountMenuOpen(false);
                setSettingsFlyoutOpen(false);
                goBrowse();
                closeAllMenus();
              }}
            >
              <GridIcon className="h-[18px] w-[18px] shrink-0" />
              Marketplace
            </button>
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 ${navPill(activeView === VIEWS.CART)}`}
              onClick={() => {
                goCart();
                closeAllMenus();
              }}
            >
              <MenuCartIcon className="h-[18px] w-[18px] shrink-0" />
              Add to cart
              {cartItemCount > 0 ? (
                <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900">
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 ${navPill(activeView === VIEWS.MY_PURCHASES)}`}
              onClick={() => {
                goMyPurchases();
                closeAllMenus();
              }}
            >
              <MenuFileIcon className="h-[18px] w-[18px] shrink-0" />
              Purchases
              {purchasesItemCount > 0 ? (
                <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900">
                  {purchasesItemCount > 99 ? "99+" : purchasesItemCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 ${navPill(activeView === VIEWS.ORDERS)}`}
              aria-label={
                ordersItemCount > 0
                  ? `Orders, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} seller alerts`
                  : "Orders"
              }
              title={
                ordersItemCount > 0
                  ? `${ordersItemCount > 99 ? "99+" : ordersItemCount} pending or updated seller order${ordersItemCount === 1 ? "" : "s"}`
                  : undefined
              }
              onClick={() => {
                goOrders();
                closeAllMenus();
              }}
            >
              <MenuOrdersIcon className="h-[18px] w-[18px] shrink-0" />
              Orders
              {ordersItemCount > 0 ? (
                <span
                  className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900"
                  aria-hidden
                >
                  {ordersItemCount > 99 ? "99+" : ordersItemCount}
                </span>
              ) : null}
            </button>
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
                activeView === VIEWS.MESSAGES ? "ring-2 ring-brand-primary/40" : ""
              }`}
              aria-label="Messages"
              onClick={() => {
                setActiveView(VIEWS.MESSAGES);
                closeAllMenus();
              }}
            >
              <MessagesIcon />
            </button>
            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
                activeView === VIEWS.NOTIFICATIONS ? "ring-2 ring-brand-primary/40" : ""
              }`}
              aria-label="Notifications"
              onClick={() => {
                setActiveView(VIEWS.NOTIFICATIONS);
                closeAllMenus();
              }}
            >
              <NotificationsIcon />
            </button>
            <button
              type="button"
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
                activeView === VIEWS.FAVORITES ? "ring-2 ring-brand-primary/40 text-brand-primary" : ""
              }`}
              aria-label="My Favorites"
              onClick={() => {
                setActiveView(VIEWS.FAVORITES);
                closeAllMenus();
              }}
            >
              <HeartIcon filled={activeView === VIEWS.FAVORITES} />
            </button>
          </div>
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200/90 bg-white px-2 py-1.5 pl-1.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              onClick={openAccount}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand-primary">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (String(user?.username || "").trim().charAt(0) || "?").toUpperCase()
                )}
              </span>
              <span className="max-w-[8rem] truncate lg:max-w-[10rem]">{accountLabel}</span>
              <ChevronDownIcon className={`shrink-0 text-neutral-500 transition-transform dark:text-slate-400 ${accountMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {accountMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1.5 w-[min(100vw-1.5rem,18.5rem)] min-w-[17rem] overflow-visible rounded-xl border border-neutral-200/90 bg-white p-1 shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.2)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={accountMenuItemBase}
                  onClick={() => {
                    setActiveView(VIEWS.PROFILE);
                    closeAllMenus();
                  }}
                >
                  <span className={accountMenuIconWrap} aria-hidden>
                    <MenuUserIcon />
                  </span>
                  My Profile
                </button>
                <div role="none" className="mx-1 my-1.5 border-t border-neutral-200/90 dark:border-slate-700/90" />
                <div className="relative" ref={settingsRowRef}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${accountMenuItemBase} justify-between gap-2`}
                    aria-expanded={settingsFlyoutOpen}
                    aria-controls="account-settings-flyout"
                    onClick={() => setSettingsFlyoutOpen((v) => !v)}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={accountMenuIconWrap} aria-hidden>
                        <MenuSettingsIcon />
                      </span>
                      Settings
                    </span>
                    <ChevronRightIcon
                      className={`h-[18px] w-[18px] shrink-0 text-neutral-400 transition-transform dark:text-slate-500 ${settingsFlyoutOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {settingsFlyoutOpen ? (
                    <div
                      ref={settingsFlyoutRef}
                      id="account-settings-flyout"
                      role="menu"
                      className="absolute right-full top-0 z-[60] mr-1.5 w-[min(calc(100vw-2rem),16rem)] min-w-[14rem] rounded-xl border border-neutral-200/90 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.1),0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
                    >
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Theme</p>
                      <ThemeToggleGroup theme={theme} setTheme={setTheme} />
                      <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Preferences</p>
                      <p className="text-xs text-neutral-500 dark:text-slate-400">Notification controls will appear here.</p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg border border-neutral-200/90 px-3 py-2 text-left text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100/90 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/90"
                        onClick={() => {
                          setActiveView(VIEWS.USERS);
                          closeAllMenus();
                        }}
                      >
                        Community directory
                      </button>
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

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <button
            type="button"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
              activeView === VIEWS.MESSAGES ? "ring-2 ring-brand-primary/40" : ""
            }`}
            aria-label="Messages"
            onClick={() => {
              setActiveView(VIEWS.MESSAGES);
              closeAllMenus();
            }}
          >
            <MessagesIcon />
          </button>
          <button
            type="button"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
              activeView === VIEWS.NOTIFICATIONS ? "ring-2 ring-brand-primary/40" : ""
            }`}
            aria-label="Notifications"
            onClick={() => {
              setActiveView(VIEWS.NOTIFICATIONS);
              closeAllMenus();
            }}
          >
            <NotificationsIcon />
          </button>
          <button
            type="button"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 ${
              activeView === VIEWS.FAVORITES ? "ring-2 ring-brand-primary/40 text-brand-primary" : ""
            }`}
            aria-label="My Favorites"
            onClick={() => {
              setActiveView(VIEWS.FAVORITES);
              closeAllMenus();
            }}
          >
            <HeartIcon filled={activeView === VIEWS.FAVORITES} />
          </button>
          <button
            ref={mobileMenuButtonRef}
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            onClick={() => {
              setMobileMenuOpen((v) => !v);
            }}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu-panel"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
    </header>

      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            className={`fixed inset-x-0 top-[4.25rem] z-[60] bg-slate-900/50 backdrop-blur-[3px] transition-opacity duration-300 ease-out motion-reduce:transition-none lg:hidden bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] ${
              mobileSheetEntered ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Close menu"
            onClick={closeMobileSheetAnimated}
          />
          <div
            ref={mobileMenuPanelRef}
            id="mobile-nav-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-account-sheet-title"
            className="fixed inset-x-0 z-[70] flex justify-center px-4 pt-2 lg:hidden bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pointer-events-none"
          >
            <div className="app-container flex w-full max-w-7xl justify-center pointer-events-auto">
              <div
                ref={mobileSheetSurfaceRef}
                onTransitionEnd={handleMobileSheetTransitionEnd}
                className={`max-h-[min(72dvh,calc(100dvh-4.25rem-4rem))] w-full max-w-lg origin-bottom transform overflow-hidden rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-12px_40px_-8px_rgba(15,23,42,0.16)] transition-transform duration-300 ease-out motion-reduce:duration-75 dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.45)] ${
                  mobileSheetEntered ? "translate-y-0" : "translate-y-full"
                }`}
              >
                <div className="sticky top-0 z-10 border-b border-neutral-100 bg-white/95 px-3 pb-2 pt-2 backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex justify-center pb-2 pt-0.5" aria-hidden>
                    <span className="h-1 w-9 rounded-full bg-neutral-300 dark:bg-slate-600" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h2 id="mobile-account-sheet-title" className="text-base font-semibold text-neutral-900 dark:text-slate-100">
                        Account
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-slate-400">Signed in as {accountLabel}</p>
                    </div>
                    <button
                      ref={mobileSheetCloseRef}
                      type="button"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/90 text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/35 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label="Close menu"
                      onClick={closeMobileSheetAnimated}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                <div className="max-h-[min(calc(72dvh-7rem),calc(100dvh-4.25rem-11rem))] overflow-y-auto overscroll-contain px-2 pb-3 [-webkit-overflow-scrolling:touch]">
                <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              className={`${accountMenuItemBase} rounded-xl`}
              onClick={() => {
                setActiveView(VIEWS.PROFILE);
                finalizeMobileSheetClose();
              }}
            >
              <span className={accountMenuIconWrap} aria-hidden>
                <MenuUserIcon />
              </span>
              My Profile
            </button>
            <button
              type="button"
              className={`${accountMenuItemBase} justify-between gap-2 rounded-xl`}
              aria-expanded={mobileSettingsOpen}
              aria-controls="mobile-account-settings"
              onClick={() => setMobileSettingsOpen((v) => !v)}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={accountMenuIconWrap} aria-hidden>
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
                className="mx-0.5 mb-1 rounded-xl border border-neutral-200/90 bg-neutral-50/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-800/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Theme</p>
                <ThemeToggleGroup theme={theme} setTheme={setTheme} />
                <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Preferences</p>
                <p className="text-xs text-neutral-500 dark:text-slate-400">Notification controls will appear here.</p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg border border-neutral-200/90 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100/90 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/90"
                  onClick={() => {
                    setActiveView(VIEWS.USERS);
                    finalizeMobileSheetClose();
                  }}
                >
                  Community directory
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={`${accountMenuItemBase} rounded-xl`}
              onClick={() => {
                setActiveView(VIEWS.ABOUT);
                finalizeMobileSheetClose();
              }}
            >
              <span className={accountMenuIconWrap} aria-hidden>
                <MenuInfoIcon />
              </span>
              About
            </button>
            <button
              type="button"
              className={`${accountMenuItemBase} rounded-xl`}
              onClick={() => {
                setActiveView(VIEWS.TERMS);
                finalizeMobileSheetClose();
              }}
            >
              <span className={accountMenuIconWrap} aria-hidden>
                <MenuFileIcon />
              </span>
              Terms & Conditions
            </button>
            <button
              type="button"
              className={`${accountMenuItemBase} mt-0.5 rounded-xl font-medium text-rose-700 hover:bg-rose-50/90 dark:text-rose-400 dark:hover:bg-rose-950/45`}
              onClick={() => {
                onLogout();
                finalizeMobileSheetClose();
              }}
            >
              <span className={accountMenuIconWrapDanger} aria-hidden>
                <MenuLogOutIcon />
              </span>
              Logout
            </button>
                </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    <nav
      className="fixed inset-x-0 bottom-0 z-[40] border-t border-neutral-200/90 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 lg:hidden"
      aria-label="Main"
    >
      <div className="app-container flex items-stretch justify-between gap-0.5">
        <button
          type="button"
          className={bottomNavItemClass(browsePillActive)}
          onClick={() => {
            setAccountMenuOpen(false);
            setSettingsFlyoutOpen(false);
            goBrowse();
            closeAllMenus();
          }}
        >
          <GridIcon className="shrink-0" />
          <span className="max-w-[3.25rem] truncate sm:max-w-none">Marketplace</span>
        </button>
        <button
          type="button"
          className={bottomNavItemClass(activeView === VIEWS.CART)}
          onClick={() => {
            goCart();
            closeAllMenus();
          }}
        >
          <span className="relative inline-flex">
            <MenuCartIcon className="shrink-0" />
            {cartItemCount > 0 ? (
              <span className="absolute -right-2 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 py-[1px] text-[9px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            ) : null}
          </span>
          <span className="max-w-[3.25rem] truncate sm:max-w-none">Add to cart</span>
        </button>
        <button
          type="button"
          className={bottomNavItemClass(activeView === VIEWS.MY_PURCHASES)}
          onClick={() => {
            goMyPurchases();
            closeAllMenus();
          }}
        >
          <span className="relative inline-flex">
            <MenuFileIcon className="shrink-0" />
            {purchasesItemCount > 0 ? (
              <span className="absolute -right-2 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 py-[1px] text-[9px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900">
                {purchasesItemCount > 99 ? "99+" : purchasesItemCount}
              </span>
            ) : null}
          </span>
          <span className="max-w-[3.25rem] truncate sm:max-w-none">Purchases</span>
        </button>
        <button
          type="button"
          className={bottomNavItemClass(activeView === VIEWS.ORDERS)}
          aria-label={
            ordersItemCount > 0
              ? `Orders, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} seller alerts`
              : "Orders"
          }
          title={
            ordersItemCount > 0
              ? `${ordersItemCount > 99 ? "99+" : ordersItemCount} pending or updated seller order${ordersItemCount === 1 ? "" : "s"}`
              : undefined
          }
          onClick={() => {
            goOrders();
            closeAllMenus();
          }}
        >
          <span className="relative inline-flex">
            <MenuOrdersIcon className="shrink-0" />
            {ordersItemCount > 0 ? (
              <span
                className="absolute -right-2 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 py-[1px] text-[9px] font-bold leading-none text-white dark:bg-brand-accent dark:text-slate-900"
                aria-hidden
              >
                {ordersItemCount > 99 ? "99+" : ordersItemCount}
              </span>
            ) : null}
          </span>
          <span className="max-w-[3.25rem] truncate sm:max-w-none">Orders</span>
        </button>
      </div>
    </nav>
    </>
  );
}
