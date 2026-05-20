/**
 * 24×24 stroke icons for Activity order-status tabs (Pending / Processing / Completed / Cancelled).
 */
export function OrderStatusTabGlyph({ tabId, selected, selectedAccentClass, className = "" }) {
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
    case "pending":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "processing":
      return (
        <svg {...svgProps}>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      );
    case "completed":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "cancelled":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" x2="9" y1="9" y2="15" />
          <line x1="9" x2="15" y1="9" y2="15" />
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
