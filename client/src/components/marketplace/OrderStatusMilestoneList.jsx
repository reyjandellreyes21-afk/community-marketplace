import { memo } from "react";

import { OrderCancellationSummary } from "./OrderCancellationSummary.jsx";

export function formatOrderCompletedAtLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Status-tab milestone times: pending → processing → completed / cancelled as appropriate. */
export const OrderStatusMilestoneList = memo(function OrderStatusMilestoneList({
  order,
  contextTab,
  className = "",
  /** `"buyer"` | `"seller"` — wording for who cancelled (optional). */
  viewerRole = null,
}) {
  const tab = String(contextTab || "");
  const createdRaw = order?.createdAt ?? order?.created_at;
  const processingRaw = order?.processingEnteredAt ?? order?.processing_entered_at;
  const completedRaw = order?.completedAt ?? order?.completed_at;
  const cancelledRaw = order?.cancelledAt ?? order?.cancelled_at;
  const updatedRaw = order?.updatedAt ?? order?.updated_at;

  const items = [];

  if (tab === "pending") {
    if (createdRaw) {
      const t = formatOrderCompletedAtLabel(createdRaw);
      if (t) items.push({ key: "pending", label: "Pending", time: t });
    }
  } else if (tab === "processing") {
    if (createdRaw) {
      const t = formatOrderCompletedAtLabel(createdRaw);
      if (t) items.push({ key: "placed", label: "Pending", time: t });
    }
    if (processingRaw) {
      const t = formatOrderCompletedAtLabel(processingRaw);
      if (t) items.push({ key: "processing", label: "Sent to processing", time: t });
    } else if (updatedRaw && items.length > 0) {
      const t = formatOrderCompletedAtLabel(updatedRaw);
      if (t) items.push({ key: "processing-fallback", label: "Last updated", time: t });
    }
  } else if (tab === "completed") {
    if (createdRaw) {
      const t = formatOrderCompletedAtLabel(createdRaw);
      if (t) items.push({ key: "placed", label: "Pending", time: t });
    }
    if (processingRaw) {
      const t = formatOrderCompletedAtLabel(processingRaw);
      if (t) items.push({ key: "processing", label: "Sent to processing", time: t });
    }
    const doneIso = completedRaw || updatedRaw;
    if (doneIso) {
      const t = formatOrderCompletedAtLabel(doneIso);
      if (t) items.push({ key: "completed", label: "Completed", time: t });
    }
  } else if (tab === "cancelled") {
    if (createdRaw) {
      const t = formatOrderCompletedAtLabel(createdRaw);
      if (t) items.push({ key: "placed", label: "Pending", time: t });
    }
    const cancelIso = cancelledRaw || updatedRaw;
    if (cancelIso) {
      const t = formatOrderCompletedAtLabel(cancelIso);
      if (t) items.push({ key: "cancelled", label: "Cancelled", time: t });
    }
  }

  const doneIsoForGap = tab === "completed" ? completedRaw || updatedRaw : null;
  const showProcessingGapNote =
    tab === "completed" && !processingRaw && Boolean(createdRaw) && Boolean(doneIsoForGap);

  const showCancellationBlock = tab === "cancelled";

  if (items.length === 0 && !showCancellationBlock) return null;

  const timelineCardClass =
    "max-w-full overflow-hidden rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-1.5 md:px-3 md:py-2 dark:border-slate-600/80 dark:bg-slate-900/50";

  if (items.length === 0 && showCancellationBlock) {
    return (
      <OrderCancellationSummary order={order} viewerRole={viewerRole} className={className} dense={false} />
    );
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {items.length > 0 ? (
        <div className={timelineCardClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">
            Order timeline
          </p>
          <ul className="mt-1.5 space-y-1.5 text-[11px] text-neutral-600 dark:text-slate-400">
            {items.map((it) => (
              <li key={it.key} className="flex flex-col gap-0.5 md:flex-row md:flex-wrap md:items-baseline md:gap-x-1.5">
                <span className="shrink-0 font-medium text-neutral-800 dark:text-slate-200">{it.label}</span>
                <span className="hidden md:inline text-neutral-400 dark:text-slate-500">·</span>
                <span className="min-w-0 break-words text-neutral-600 dark:text-slate-400">{it.time}</span>
              </li>
            ))}
          </ul>
          {showProcessingGapNote ? (
            <p className="mt-1.5 text-pretty text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
              Sent-to-processing time was not recorded for this order (older data or edge case).
            </p>
          ) : null}
        </div>
      ) : null}
      {showCancellationBlock ? (
        <OrderCancellationSummary order={order} viewerRole={viewerRole} dense={items.length > 0} />
      ) : null}
    </div>
  );
});
