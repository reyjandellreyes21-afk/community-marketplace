import { createElement } from "react";

/* eslint-disable react-refresh/only-export-components -- row config is data + icon refs, not a separate refresh boundary */
function LandingFeatureIconDiscussion(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function LandingFeatureIconExchange(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function LandingFeatureIconBuddy(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function LandingFeatureRow({ Icon, eyebrow, title, body }) {
  return (
    <div className="flex gap-4 sm:gap-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-accent shadow-sm dark:bg-slate-800 dark:text-brand-accent">
        {createElement(Icon, { className: "h-5 w-5" })}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{eyebrow}</p>
        <h3 className="mt-1 text-base font-bold leading-snug text-neutral-900 dark:text-slate-100 sm:text-lg">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );
}

export const LANDING_FEATURE_ROWS = [
  {
    Icon: LandingFeatureIconDiscussion,
    eyebrow: "Verified Local Sellers",
    title: "Buy with more confidence nearby",
    body: "Transact with sellers in your own community so pickups and communication are easier to manage.",
  },
  {
    Icon: LandingFeatureIconExchange,
    eyebrow: "Fast Local Listings",
    title: "Post and sell in minutes",
    body: "Create listings quickly and reach active buyers around your area without complex setup.",
  },
  {
    Icon: LandingFeatureIconBuddy,
    eyebrow: "Community Connections",
    title: "Build trust through repeat transactions",
    body: "Grow your reputation with neighbors and keep a reliable marketplace network close to home.",
  },
];
