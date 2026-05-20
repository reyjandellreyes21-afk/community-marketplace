import { cancellationByLabel, cancellationReasonDisplay } from "../../lib/orderCancellationReasons.js";

/**
 * Shows who cancelled (buyer vs seller, viewer-relative) and the chosen reason (+ optional note).
 */
export function OrderCancellationSummary({ order, viewerRole, className = "", dense = false }) {
  const who = cancellationByLabel(order, viewerRole);
  const reason = cancellationReasonDisplay(order);

  const pad = dense ? "px-2 py-1.5" : "px-2.5 py-2 md:px-3 md:py-2.5";
  const text = dense ? "text-[10px]" : "text-[11px]";

  /** Avoid “Cancelled by Not recorded” — legacy rows often omit role + reason. */
  const noCancellationDetails = !who && !reason;

  if (noCancellationDetails) {
    return (
      <div
        className={`rounded-lg border border-neutral-200/80 bg-neutral-50/90 dark:border-slate-600/80 dark:bg-slate-900/45 ${pad} ${className}`.trim()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">Cancellation</p>
        <p className={`${text} mt-1 leading-snug text-neutral-600 dark:text-slate-400`}>
          Cancellation details were not recorded for this order (older data or edge case).
        </p>
      </div>
    );
  }

  const whoShown = who ?? "Unknown";
  const reasonShown = reason ?? "Not specified";

  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-neutral-50/90 dark:border-slate-600/80 dark:bg-slate-900/45 ${pad} ${className}`.trim()}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">Cancellation</p>
      <p className={`${text} mt-1 leading-snug text-neutral-800 dark:text-slate-200`}>
        <span className="font-semibold text-neutral-700 dark:text-slate-300">Cancelled by</span>{" "}
        <span className={who ? "" : "text-neutral-500 dark:text-slate-500"}>{whoShown}</span>
      </p>
      <p className={`${text} mt-1 leading-snug text-neutral-800 dark:text-slate-200`}>
        <span className="font-semibold text-neutral-700 dark:text-slate-300">Reason</span>{" "}
        <span className={reason ? "" : "text-neutral-500 dark:text-slate-500"}>{reasonShown}</span>
      </p>
    </div>
  );
}
