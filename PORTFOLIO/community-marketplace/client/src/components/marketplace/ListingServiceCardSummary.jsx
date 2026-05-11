import { getServiceCardSummaryRows } from "../../lib/listingServiceCardMeta.js";

/**
 * Compact service details from `listing.serviceMeta` for cards (seller, browse, modal).
 * All dynamic fields are shown; pass `maxRows` only to limit trailing common rows (rate, area, …).
 * @param {"seller"|"browse"|"inspect"} [props.variant]
 */
export function ListingServiceCardSummary({ listing, variant = "seller", maxRows }) {
  const rows = getServiceCardSummaryRows(listing, {
    maxRows,
    omitCategoryAndServiceTitle: true,
  });
  if (!rows.length) return null;

  const labelClass =
    variant === "inspect"
      ? "font-semibold text-neutral-700 dark:text-slate-300"
      : "font-medium text-neutral-700 dark:text-slate-300";
  const valueClass =
    variant === "inspect"
      ? "text-neutral-800 dark:text-slate-200"
      : "text-neutral-800 dark:text-slate-100";
  const rowClass =
    variant === "browse"
      ? "text-[12px] font-medium leading-snug text-text-secondary dark:text-slate-300"
      : variant === "inspect"
        ? "text-xs leading-snug text-neutral-600 dark:text-slate-400"
        : `text-xs text-neutral-600 dark:text-slate-400 ${variant === "seller" ? "md:text-[13px]" : ""}`;

  return (
    <div className={`min-w-0 space-y-1 ${variant === "inspect" ? "space-y-1.5" : ""}`}>
      {variant === "browse" ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary/80 dark:text-slate-400">Service details</p>
      ) : variant === "inspect" ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Service details</p>
      ) : null}
      {rows.map((row, i) => (
        <p key={`${row.label}-${i}`} className={`${rowClass} text-pretty`}>
          <span className={labelClass}>{row.label}:</span>{" "}
          <span className={`${valueClass} font-semibold`}>{row.value}</span>
        </p>
      ))}
    </div>
  );
}
