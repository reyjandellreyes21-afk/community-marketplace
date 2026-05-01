import { COURIER_TABS } from "../views.js";

/**
 * Icons for Activity → Courier sub-tabs (Deliver / Buying / Selling).
 */
export function CourierHubTabGlyph({ tabId, selected, selectedAccentClass, className = "" }) {
  const tone = selected
    ? selectedAccentClass ?? "text-primary dark:text-brand-accent"
    : "text-neutral-500 dark:text-slate-500";
  const cn = `h-6 w-6 shrink-0 ${tone} ${className}`;
  const svgProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: cn,
    "aria-hidden": true,
  };

  switch (tabId) {
    case COURIER_TABS.DELIVER:
      return (
        <svg {...svgProps}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      );
    case COURIER_TABS.SELL:
      return (
        <svg {...svgProps}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 18v-2" />
          <path d="M3.29 7 12 12l8.71-5" />
        </svg>
      );
    case COURIER_TABS.BUY:
      return (
        <svg {...svgProps}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
