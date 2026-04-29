import { useCallback, useEffect, useRef, useState } from "react";
import { LinkMartLogo } from "./media/LinkMartLogo.jsx";
import { StableAvatar } from "./media/StableMediaImage.jsx";
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
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4.5 8.25h15v9.25a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
      <path d="M7 8.25V6.5a1.75 1.75 0 0 1 1.75-1.75h6.5A1.75 1.75 0 0 1 17 6.5v1.75" />
      <path d="M9.5 11.5h5" />
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
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M7 4.75h7l3.25 3.25V19a2 2 0 0 1-2 2H7A2 2 0 0 1 5 19V6.75a2 2 0 0 1 2-2z" />
      <path d="M14 4.75V8h3.25" />
      <path d="M8.75 12h6.5M8.75 15.5h6.5" />
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
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6.5 4.75h11a1.75 1.75 0 0 1 1.75 1.75v11a1.75 1.75 0 0 1-1.75 1.75h-11A1.75 1.75 0 0 1 4.75 17.5v-11A1.75 1.75 0 0 1 6.5 4.75z" />
      <path d="M8.5 9.25h7M8.5 12.25h7M8.5 15.25h4.5" />
    </svg>
  );
}

function MenuCartIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <circle cx="9" cy="19.25" r="1.25" />
      <circle cx="17" cy="19.25" r="1.25" />
      <path d="M3 4h1.8l1.35 8.9a1.5 1.5 0 0 0 1.48 1.28h8.82a1.5 1.5 0 0 0 1.45-1.11l1.3-4.95H6.65" />
    </svg>
  );
}

function MenuTruckIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3.75 6.75h10.5v8.5H3.75z" />
      <path d="M14.25 9.75h3.2l2.8 2.8v2.7h-6" />
      <circle cx="8" cy="18.25" r="1.5" />
      <circle cx="18" cy="18.25" r="1.5" />
      <path d="M3.75 18.25h2.75M14.25 18.25h2.25" />
    </svg>
  );
}

function MenuFeedbackIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6.5 4.75h11a1.75 1.75 0 0 1 1.75 1.75v7A1.75 1.75 0 0 1 17.5 15.25h-5.2L8 19v-3.75H6.5A1.75 1.75 0 0 1 4.75 13.5v-7A1.75 1.75 0 0 1 6.5 4.75z" />
      <path d="M9.1 10.75h5.8" />
    </svg>
  );
}

/** Mobile secondary nav icons — 24×24, unified 1.75 stroke / filled-solid pairs (mobile strip only). */
const MOBILE_NAV_ICON_STROKE = 1.75;

function MobileNavShopIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M5 9h14l-1.25 9.25A1.75 1.75 0 0116.52 20H7.48a1.75 1.75 0 01-1.73-1.75L5 9zm2.5-5.25h9L18 8H6l1.5-4.25zM10 21.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75z"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M5 10h14v9a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19v-9z" />
      <path d="M5 10V8.5l2.25-5h9.5L19 8.5V10" />
      <path d="M10 21.25h4" />
    </svg>
  );
}

function MobileNavCartIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M8.25 18.5a1.75 1.75 0 11-.001 3.501A1.75 1.75 0 018.25 18.5zm9.5 0a1.75 1.75 0 11-.001 3.501 1.75 1.75 0 01.001-3.501zM2.25 3.75h2.02l.37 1.5h14.47a.75.75 0 01.73.92l-1.56 6.02a1.5 1.5 0 01-1.45 1.12H8.18l-.98 5.29h12.05a.75.75 0 010 1.5H6.53a1.5 1.5 0 01-1.48-1.22l-3.09-15.1a.75.75 0 01.73-.89H4.4l-.4-1.59a.75.75 0 01.75-.93z"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <circle cx="9" cy="20.25" r="1.25" />
      <circle cx="17" cy="20.25" r="1.25" />
      <path d="M3.25 3.75h1.7l1.35 9.05a1.25 1.25 0 001.24 1.07h9.37a1.25 1.25 0 001.21-.94l1.46-5.68H6.42" />
    </svg>
  );
}

/** Buying — shopping bag / orders */
function MobileNavBuyingIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M8.25 6.5V5.5a3.75 3.75 0 017.5 0v1h4.25a1.25 1.25 0 011.25 1.25v10.5a2 2 0 01-2 2H5a2 2 0 01-2-2V7.75a1.25 1.25 0 011.25-1.25h4zm1.5 0h5V5.5a2.25 2.25 0 10-4.5 0v1z"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M6 8.25V7a4 4 0 018 0v1.25" />
      <path d="M5.25 8.25h13.5a1.25 1.25 0 011.25 1.25v9a2 2 0 01-2 2h-12a2 2 0 01-2-2v-9a1.25 1.25 0 011.25-1.25z" />
    </svg>
  );
}

/** Selling — price tag / listing */
function MobileNavSellingIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M12.95 2.25h-6.7a2.25 2.25 0 00-1.59.66l-3.24 3.24a2.25 2.25 0 000 3.18l8.46 8.46a2.25 2.25 0 003.18 0l5.66-5.66a2.25 2.25 0 000-3.18l-5.77-5.9z"
        />
        <circle cx="8.25" cy="8.25" r="1.65" className="fill-white dark:fill-slate-950" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M12.5 2.5h-6a2 2 0 00-1.41.59l-3 3a2 2 0 000 2.82l7.88 7.88a2 2 0 002.83 0l5.66-5.66a2 2 0 000-2.83l-5.96-5.78z" />
      <circle cx="8.25" cy="8.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MobileNavNotificationsIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M12 2.25a5.25 5.25 0 00-5.25 5.25c0 3.48-1.15 4.77-2.05 5.67a.75.75 0 00.53 1.28h13.54a.75.75 0 00.53-1.28c-.9-.9-2.05-2.19-2.05-5.67A5.25 5.25 0 0012 2.25zm0 19.5a2.25 2.25 0 002.18-1.7H9.82A2.25 2.25 0 0012 21.75z"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function MobileNavProfileIcon({ filled = false, className = "", ...props }) {
  if (filled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" className={className} aria-hidden {...props}>
        <path
          fill="currentColor"
          d="M12 11.25a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zm-7.2 8.77c.31-3.32 3.85-5.27 7.2-5.27s6.89 1.95 7.2 5.27a.75.75 0 01-.74.88H5.54a.75.75 0 01-.74-.88z"
        />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={MOBILE_NAV_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="8.25" r="3.25" />
      <path d="M6.75 19.25v-.25a4.25 4.25 0 014.25-4.25h2a4.25 4.25 0 014.25 4.25v.25" />
    </svg>
  );
}

const accountMenuItemBase =
  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 outline-none transition-colors motion-reduce:transition-none hover:bg-neutral-100/90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary dark:text-slate-200 dark:hover:bg-slate-800/90 dark:focus-visible:ring-brand-accent";

const accountMenuIconWrap =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-neutral-50 text-neutral-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400";

const accountMenuIconWrapDanger =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400";

/** Mobile: squircle hit targets (no circular chrome). md+: bordered pills like desktop chrome. */
const headerUtilityButtonBase =
  "relative inline-flex h-11 w-11 items-center justify-center rounded-xl border-0 bg-transparent text-neutral-700 transition motion-reduce:transition-none hover:bg-neutral-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:bg-neutral-100/70 dark:text-slate-200 dark:hover:bg-slate-800/85 dark:focus-visible:ring-brand-accent/35 dark:focus-visible:ring-offset-slate-950 md:h-10 md:w-10 md:rounded-full md:border md:border-neutral-200/75 md:bg-white md:hover:border-neutral-300 md:hover:bg-neutral-50/90 md:active:bg-white dark:md:border-slate-600/90 dark:md:bg-slate-900 dark:md:hover:border-slate-500 dark:md:hover:bg-slate-800";

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

/** Mobile secondary nav (icon-only): inactive = outline/neutral; active = teal + filled glyph + thin underline. */
function mobileIconTabClass(active) {
  const base =
    "relative flex min-h-[var(--ui-touch-target,44px)] min-w-0 flex-1 touch-manipulation items-center justify-center px-0.5 py-2 transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40 dark:focus-visible:ring-brand-accent/40 select-none";
  if (!active) {
    return `${base} text-neutral-400 hover:text-neutral-500 dark:text-slate-500 dark:hover:text-slate-400`;
  }
  return `${base} text-brand-primary after:pointer-events-none after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-9 after:max-w-[42%] after:-translate-x-1/2 after:bg-brand-primary dark:text-brand-accent dark:after:bg-brand-accent [&_.mobile-nav-tab-icon]:text-brand-primary dark:[&_.mobile-nav-tab-icon]:text-brand-accent`;
}

const mobileNavBadgeBase =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full px-1 py-px text-[9px] font-bold leading-none shadow-sm";

const mobileSheetMenuItem = `${accountMenuItemBase} min-h-[44px] items-center rounded-xl py-3`;

/** Drawer rows: teal glyph, no boxed icon chip (mobile visual reference = Upload). */
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
 * @param {number} [props.messagesUnreadCount] Unread messages badge count
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
 * @param {number} [props.favoritesBadgeCount] Unseen favorites-related updates
 * @param {number} [props.favoriteCount] Saved favorites count (shop / community product hearts)
 * @param {() => void} [props.onNavigateHome] Clear SPA path (e.g. /l/…) when opening marketplace from the logo
 * @param {import('react').ReactNode} [props.children] Main scroll region (below the sticky header and mobile tab row)
 * @param {import('react').ReactNode} [props.mobileSecondaryNav] Optional strip below the top header (mobile only)
 * @param {(collapsed: boolean) => void} [props.onMobileBrowseNavCollapsedChange] Fires when mobile primary+secondary chrome finishes collapsing/expanding (shop-like views).
 * @param {boolean} [props.hideNavigationChrome] Hide top nav/header chrome (content only).
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
  messagesUnreadCount = 0,
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
  favoritesBadgeCount = 0,
  favoriteCount = 0,
  onNavigateHome,
  mobileSecondaryNav = null,
  onMobileBrowseNavCollapsedChange,
  hideNavigationChrome = false,
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
  /** Mobile Shop / Community shop: live scroll-linked hide offset (0..mobile chrome height). */
  const mobileChromeRef = useRef(null);
  const mainScrollLastYRef = useRef(0);
  const [mobileShopBrowseNavOffset, setMobileShopBrowseNavOffset] = useState(0);
  const [mobileShopBrowseNavCollapsed, setMobileShopBrowseNavCollapsed] = useState(false);

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

  /** When true, scroll on `#main-content` can hide the full mobile header (primary row + icon tab row + optional `mobileSecondaryNav`). */
  const mobileShopBrowseScrollCollapseActive =
    activeView === VIEWS.BROWSE ||
    activeView === VIEWS.COMMUNITY_SHOP;

  useEffect(() => {
    if (!mobileShopBrowseScrollCollapseActive || mobileMenuOpen) {
      setMobileShopBrowseNavOffset(0);
      setMobileShopBrowseNavCollapsed(false);
      return undefined;
    }
    const main = document.getElementById("main-content");
    if (!main) return undefined;

    const mq = window.matchMedia("(min-width: 768px)");

    const onScroll = () => {
      if (mq.matches) {
        mainScrollLastYRef.current = 0;
        setMobileShopBrowseNavOffset(0);
        setMobileShopBrowseNavCollapsed((prev) => (prev ? false : prev));
        return;
      }
      const y = Math.max(0, main.scrollTop || 0);
      const chromeHeight = mobileChromeRef.current?.offsetHeight ?? 0;
      const maxScrollableY = Math.max(0, (main.scrollHeight || 0) - (main.clientHeight || 0));
      const canStablyCollapse = maxScrollableY > chromeHeight + 2;
      if (!canStablyCollapse) {
        mainScrollLastYRef.current = y;
        setMobileShopBrowseNavOffset(0);
        setMobileShopBrowseNavCollapsed((prev) => (prev ? false : prev));
        return;
      }
      const delta = y - mainScrollLastYRef.current;
      mainScrollLastYRef.current = y;
      if (Math.abs(delta) < 1.5) return;
      const dampedDelta = delta * 0.55;
      setMobileShopBrowseNavOffset((prev) => {
        const next = Math.min(Math.max(prev + dampedDelta, 0), Math.max(0, chromeHeight));
        const collapsedNext = next > 10;
        setMobileShopBrowseNavCollapsed((collapsedPrev) =>
          collapsedPrev === collapsedNext ? collapsedPrev : collapsedNext
        );
        return Math.abs(next - prev) < 1.5 ? prev : next;
      });
    };

    mainScrollLastYRef.current = Math.max(0, main.scrollTop || 0);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });

    const onMm = () => {
      if (mq.matches) {
        setMobileShopBrowseNavOffset(0);
        setMobileShopBrowseNavCollapsed((prev) => (prev ? false : prev));
      }
    };
    mq.addEventListener("change", onMm);

    return () => {
      main.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMm);
    };
  }, [mobileShopBrowseScrollCollapseActive, mobileMenuOpen, activeView]);

  useEffect(() => {
    onMobileBrowseNavCollapsedChange?.(mobileShopBrowseNavCollapsed);
  }, [mobileShopBrowseNavCollapsed, onMobileBrowseNavCollapsedChange]);

  const mobileSellingTabActive =
    activeView === VIEWS.ORDERS ||
    activeView === VIEWS.SELLER ||
    activeView === VIEWS.MY_LISTINGS;
  /** Mobile: hide top utility row on secondary tabs (keep visible on Shop-like views). */
  const hideMobilePrimaryRow =
    activeView === VIEWS.CART ||
    activeView === VIEWS.MY_PURCHASES ||
    activeView === VIEWS.ORDERS ||
    activeView === VIEWS.SELLER ||
    activeView === VIEWS.MY_LISTINGS ||
    activeView === VIEWS.MESSAGES ||
    activeView === VIEWS.NOTIFICATIONS ||
    activeView === VIEWS.PROFILE;

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
    <header
      className={`mobile-app-top-header sticky top-0 z-50 shrink-0 pt-[env(safe-area-inset-top,0px)] md:sticky md:top-0 border-b border-neutral-200/40 bg-white/95 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/95 md:shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
        hideNavigationChrome ? "hidden" : ""
      }`}
    >
      {/*
        Mobile only (md:hidden): primary + secondary chrome — grid 0fr/1fr collapse (smoother than max-height).
        Desktop header is a sibling block with md:flex — unchanged.
      */}
      <div
        ref={mobileChromeRef}
        className="md:hidden grid shrink-0 grid-rows-[1fr] will-change-transform"
        style={
          mobileShopBrowseScrollCollapseActive && !mobileMenuOpen
            ? {
                transform: `translate3d(0, -${mobileShopBrowseNavOffset}px, 0)`,
                marginBottom: `-${mobileShopBrowseNavOffset}px`,
              }
            : undefined
        }
      >
        <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col">
        <div
          className={`app-shell-content-inset flex w-full max-w-full items-center gap-2 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
            hideMobilePrimaryRow
              ? "pointer-events-none max-h-0 -translate-y-1 opacity-0"
              : "h-[4.25rem] max-h-[4.25rem] translate-y-0 opacity-100"
          }`}
          aria-hidden={hideMobilePrimaryRow ? true : undefined}
        >
          <button
            ref={mobileMenuButtonRef}
            type="button"
            className={`${headerUtilityButtonBase} h-11 w-11 min-h-[var(--ui-touch-target,44px)] min-w-[var(--ui-touch-target,44px)] shrink-0 ${mobileMenuOpen ? headerUtilityButtonActive : "text-neutral-500 dark:text-slate-500"}`}
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
            className={`${headerUtilityButtonBase} relative h-11 w-11 min-h-[var(--ui-touch-target,44px)] min-w-[var(--ui-touch-target,44px)] shrink-0 ${activeView === VIEWS.FAVORITES ? headerUtilityButtonActive : "text-neutral-500 dark:text-slate-500"}`}
            aria-label={
              favoritesBadgeCount > 0
                ? `Favorites, ${favoritesBadgeCount > 99 ? "99 plus" : favoritesBadgeCount} new updates`
                : "Favorites"
            }
            title={favoritesBadgeCount > 0 ? `${favoritesBadgeCount > 99 ? "99+" : favoritesBadgeCount} new updates` : "Saved listings"}
            onClick={() => {
              setActiveView(VIEWS.FAVORITES);
              closeAllMenus();
            }}
          >
            <HeartIcon
              filled={activeView === VIEWS.FAVORITES}
              className={activeView === VIEWS.FAVORITES ? "text-primary dark:text-brand-accent" : ""}
            />
            {favoritesBadgeCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                {favoritesBadgeCount > 99 ? "99+" : favoritesBadgeCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${headerUtilityButtonBase} relative h-11 w-11 min-h-[var(--ui-touch-target,44px)] min-w-[var(--ui-touch-target,44px)] shrink-0 ${activeView === VIEWS.MESSAGES ? headerUtilityButtonActive : "text-neutral-500 dark:text-slate-500"}`}
            aria-label={
              messagesUnreadCount > 0
                ? `Messages, ${messagesUnreadCount > 99 ? "99 plus" : messagesUnreadCount} unread`
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
            {messagesUnreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
              </span>
            ) : null}
          </button>
        </div>

        <nav className="mobile-app-secondary-nav" role="navigation" aria-label="Main sections">
          <div
            className="app-shell-content-inset flex min-h-[var(--ui-touch-target,44px)] w-full max-w-full items-stretch gap-0.5 py-1 min-[360px]:gap-1 min-[390px]:gap-1.5 min-[430px]:gap-2"
            role="tablist"
            aria-label="Home, cart, purchases, orders, notifications, and profile"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileShopTabActive}
              aria-current={mobileShopTabActive ? "page" : undefined}
              className={mobileIconTabClass(mobileShopTabActive)}
              aria-label="Home"
              onClick={() => {
                setAccountMenuOpen(false);
                setDesktopSettingsOpen(false);
                goMarketplaceRoot();
                closeAllMenus();
              }}
            >
              <span className="mobile-nav-tab-icon relative inline-flex size-6 shrink-0 items-center justify-center" aria-hidden>
                <MobileNavShopIcon filled={mobileShopTabActive} className="h-6 w-6 shrink-0" aria-hidden />
              </span>
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
              <span className="mobile-nav-tab-icon relative inline-flex size-6 min-w-[24px] shrink-0 items-center justify-center">
                <MobileNavCartIcon filled={activeView === VIEWS.CART} className="h-6 w-6 shrink-0" aria-hidden />
                {cartItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-rose-600 text-white dark:bg-rose-500`}>
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : totalCartCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-rose-600 text-white dark:bg-rose-500`} aria-hidden>
                    {totalCartCount > 99 ? "99+" : totalCartCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === VIEWS.MY_PURCHASES}
              aria-current={activeView === VIEWS.MY_PURCHASES ? "page" : undefined}
              className={mobileIconTabClass(activeView === VIEWS.MY_PURCHASES)}
              aria-label={
                purchasesItemCount > 0
                  ? `Purchases, ${purchasesItemCount > 99 ? "99 plus" : purchasesItemCount} updates`
                  : "Purchases"
              }
              onClick={() => {
                goMyPurchases();
                closeAllMenus();
              }}
            >
              <span className="mobile-nav-tab-icon relative inline-flex size-6 min-w-[24px] shrink-0 items-center justify-center">
                <MobileNavBuyingIcon filled={activeView === VIEWS.MY_PURCHASES} className="h-6 w-6 shrink-0" aria-hidden />
                {purchasesItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-rose-600 text-white dark:bg-rose-500`}>
                    {purchasesItemCount > 99 ? "99+" : purchasesItemCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileSellingTabActive}
              aria-current={mobileSellingTabActive ? "page" : undefined}
              className={mobileIconTabClass(mobileSellingTabActive)}
              aria-label={
                ordersItemCount > 0
                  ? `Orders, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} alerts`
                  : "Orders"
              }
              onClick={() => {
                goOrders();
                closeAllMenus();
              }}
            >
              <span className="mobile-nav-tab-icon relative inline-flex size-6 min-w-[24px] shrink-0 items-center justify-center">
                <MobileNavSellingIcon filled={mobileSellingTabActive} className="h-6 w-6 shrink-0" aria-hidden />
                {ordersItemCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-rose-600 text-white dark:bg-rose-500`}>
                    {ordersItemCount > 99 ? "99+" : ordersItemCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === VIEWS.NOTIFICATIONS}
              aria-current={activeView === VIEWS.NOTIFICATIONS ? "page" : undefined}
              className={mobileIconTabClass(activeView === VIEWS.NOTIFICATIONS)}
              aria-label={
                notificationUnreadCount > 0
                  ? `Notifications, ${notificationUnreadCount > 99 ? "99 plus" : notificationUnreadCount} unread`
                  : "Notifications"
              }
              onClick={() => {
                setActiveView(VIEWS.NOTIFICATIONS);
                closeAllMenus();
              }}
            >
              <span className="mobile-nav-tab-icon relative inline-flex size-6 min-w-[24px] shrink-0 items-center justify-center">
                <MobileNavNotificationsIcon filled={activeView === VIEWS.NOTIFICATIONS} className="h-6 w-6 shrink-0" aria-hidden />
                {notificationUnreadCount > 0 ? (
                  <span className={`${mobileNavBadgeBase} bg-rose-600 text-white dark:bg-rose-500`}>
                    {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                  </span>
                ) : null}
              </span>
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
              <span className="mobile-nav-tab-icon relative inline-flex size-6 shrink-0 items-center justify-center" aria-hidden>
                <MobileNavProfileIcon filled={activeView === VIEWS.PROFILE} className="h-6 w-6 shrink-0" aria-hidden />
              </span>
            </button>
          </div>
        </nav>

        {mobileSecondaryNav ? (
          <div className="border-t border-neutral-200/35 bg-white/90 py-2.5 dark:border-slate-700/45 dark:bg-slate-900/90">
            <div className="app-shell-content-inset">{mobileSecondaryNav}</div>
          </div>
        ) : null}
        </div>
        </div>
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
              aria-label="Home, cart, purchases, and orders"
            >
              <button
                type="button"
                className={navPillShop(browsePillActive, "browse")}
                aria-label="Home"
                title="Browse listings"
                onClick={() => {
                  setAccountMenuOpen(false);
                  setDesktopSettingsOpen(false);
                  goMarketplaceRoot();
                  closeAllMenus();
                }}
              >
                <MenuStoreIcon
                  className={`h-[18px] w-[18px] shrink-0 ${browsePillActive ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[5.5rem] truncate md:max-w-none">Home</span>
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
                  <span className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </span>
                ) : totalCartCount > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                    {totalCartCount > 99 ? "99+" : totalCartCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={navPillTrade(activeView === VIEWS.MY_PURCHASES, "buy")}
                aria-label={
                  purchasesItemCount > 0
                    ? `Purchases, ${purchasesItemCount > 99 ? "99 plus" : purchasesItemCount} updates`
                    : totalPurchasesCount > 0
                      ? `Purchases, ${totalPurchasesCount > 99 ? "99 plus" : totalPurchasesCount} order${totalPurchasesCount === 1 ? "" : "s"}`
                      : "Purchases — things you bought"
                }
                title="Purchases — track status, pickup, and COD"
                onClick={() => {
                  goMyPurchases();
                  closeAllMenus();
                }}
              >
                <MenuFileIcon
                  className={`h-[18px] w-[18px] shrink-0 ${activeView === VIEWS.MY_PURCHASES ? "text-primary dark:text-primary-soft" : ""}`}
                />
                <span className="max-w-[5.5rem] truncate md:max-w-none">Purchases</span>
                {purchasesItemCount > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
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
                    ? `Orders, ${ordersItemCount > 99 ? "99 plus" : ordersItemCount} buyer order alerts`
                    : totalOrdersCount > 0
                      ? `Orders, ${totalOrdersCount > 99 ? "99 plus" : totalOrdersCount} order${totalOrdersCount === 1 ? "" : "s"}`
                      : "Orders — orders from your buyers"
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
                <span className="max-w-[5.5rem] truncate md:max-w-none">Orders</span>
                {ordersItemCount > 0 ? (
                  <span
                    className="ml-0.5 inline-flex min-w-[1.15rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500"
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
              aria-label={
                messagesUnreadCount > 0
                  ? `Messages, ${messagesUnreadCount > 99 ? "99 plus" : messagesUnreadCount} unread`
                  : "Messages"
              }
              onClick={() => {
                setActiveView(VIEWS.MESSAGES);
                closeAllMenus();
              }}
            >
              <MessagesIcon
                filled={activeView === VIEWS.MESSAGES}
                className={activeView === VIEWS.MESSAGES ? "text-emerald-600 dark:text-emerald-300" : ""}
              />
              {messagesUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                  {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                </span>
              ) : null}
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
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                  {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`${headerUtilityButtonBase} ${activeView === VIEWS.FAVORITES ? headerUtilityButtonActive : ""}`}
              aria-label={
                favoritesBadgeCount > 0
                  ? `My Favorites, ${favoritesBadgeCount > 99 ? "99 plus" : favoritesBadgeCount} new updates`
                  : "My Favorites"
              }
              title={favoritesBadgeCount > 0 ? `${favoritesBadgeCount > 99 ? "99+" : favoritesBadgeCount} new updates` : "Saved listings"}
              onClick={() => {
                setActiveView(VIEWS.FAVORITES);
                closeAllMenus();
              }}
            >
              <HeartIcon
                filled={activeView === VIEWS.FAVORITES}
                className={activeView === VIEWS.FAVORITES ? "text-emerald-600 dark:text-emerald-300" : ""}
              />
              {favoritesBadgeCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 py-[2px] text-[10px] font-bold leading-none text-white shadow-sm dark:bg-rose-500">
                  {favoritesBadgeCount > 99 ? "99+" : favoritesBadgeCount}
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
              <StableAvatar
                src={user?.avatarUrl}
                alt=""
                initials={(String(user?.username || "").trim().charAt(0) || "?").toUpperCase()}
                className="h-8 w-8 shrink-0 text-xs"
                sizes="32px"
              />
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
            aria-label="Navigation and account menu"
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
                  className={mobileSheetMenuItem}
                  onClick={() => {
                    setActiveView(VIEWS.ORDERS);
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={mobileDrawerIconPlain} aria-hidden>
                    <MenuTruckIcon />
                  </span>
                  Courier
                </button>
                <button
                  type="button"
                  className={mobileSheetMenuItem}
                  onClick={() => {
                    setActiveView(VIEWS.SELLER);
                    finalizeMobileSheetClose();
                  }}
                >
                  <span className={mobileDrawerIconPlain} aria-hidden>
                    <MenuFeedbackIcon />
                  </span>
                  Feedback
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
