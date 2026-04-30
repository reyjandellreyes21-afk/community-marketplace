import { UI_KIT } from "../../lib/appUiKit.js";
import { normalizeListingOptionValues } from "../../lib/listingSaleMeta.js";

/**
 * Compact ready-time (in stock), pre-order lead time, + variant summary for product cards and inspect modal.
 * Renders nothing when there is no meaningful content (no placeholder rows).
 */
export function ListingProductMetaExtras({
  orderType,
  processingTime,
  optionNameA,
  optionValuesA,
  optionNameB,
  optionValuesB,
  /** `card` = browse tiles; `compact` = seller grid / dense */
  density = "card",
  /** When false, show full variant value lists (e.g. product detail modal). */
  truncateValueLists = true,
  /** When true, only variant name/value rows (hide ready-in / pre-order chips — parent shows those separately). */
  variantsOnly = false,
}) {
  const ot = String(orderType || "in_stock").trim();
  const proc = String(processingTime || "").trim();
  const showPreOrder = !variantsOnly && ot === "pre_order";
  const showReadyIn = !variantsOnly && ot === "in_stock" && Boolean(proc);
  const nameA = String(optionNameA || "").trim();
  const nameB = String(optionNameB || "").trim();
  const valsA = normalizeListingOptionValues(optionValuesA);
  const valsB = normalizeListingOptionValues(optionValuesB);
  const rowA = nameA && valsA.length > 0;
  const rowB = nameB && valsB.length > 0;
  if (variantsOnly) {
    if (!rowA && !rowB) return null;
  } else if (!showPreOrder && !showReadyIn && !rowA && !rowB) return null;

  const chipWrap =
    density === "compact"
      ? "flex flex-wrap gap-1"
      : "flex flex-wrap items-start gap-x-1.5 gap-y-1 max-md:gap-1";
  const chip =
    density === "compact"
      ? `${UI_KIT.chipMuted} py-px text-[10px] leading-tight`
      : `${UI_KIT.chipMuted} max-md:py-px max-md:text-[10px] max-md:leading-tight`;
  const timingChip =
    density === "compact"
      ? "inline-flex items-center rounded-sm border border-brand-primary/45 bg-brand-primary/12 px-2 py-px text-[10px] font-semibold leading-tight text-brand-primary dark:border-brand-accent/45 dark:bg-brand-accent/15 dark:text-slate-100"
      : "inline-flex items-center rounded-sm border border-brand-primary/45 bg-brand-primary/12 px-2 py-0.5 text-[10px] font-semibold leading-tight text-brand-primary min-[380px]:text-xs dark:border-brand-accent/45 dark:bg-brand-accent/15 dark:text-slate-100";

  const formatValues = (vals) => {
    const s = vals.join(", ");
    if (!truncateValueLists) return s;
    return s.length > 72 ? `${s.slice(0, 69)}…` : s;
  };

  return (
    <div className={`min-w-0 ${density === "card" ? "space-y-1.5" : "space-y-1"}`}>
      {showReadyIn ? (
        <div className={chipWrap}>
          <span className={timingChip} title={`Ready in: ${proc}`}>
            Ready in: <span className="ml-1 font-semibold">{proc}</span>
          </span>
        </div>
      ) : null}
      {showPreOrder ? (
        <div className={chipWrap}>
          <span className={timingChip} title={proc ? undefined : "Pre-order listing"}>
            Pre-order
            {proc ? (
              <>
                <span className="mx-1 opacity-60" aria-hidden>
                  :
                </span>
                <span className="font-semibold">{proc}</span>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
      {rowA ? (
        <p className="min-w-0 text-[11px] leading-snug text-text-secondary min-[380px]:text-xs dark:text-slate-400">
          <span className="font-semibold text-text-primary dark:text-slate-200">{nameA}:</span>{" "}
          <span className="text-pretty text-text-primary/95 dark:text-slate-300">{formatValues(valsA)}</span>
        </p>
      ) : null}
      {rowB ? (
        <p className="min-w-0 text-[11px] leading-snug text-text-secondary min-[380px]:text-xs dark:text-slate-400">
          <span className="font-semibold text-text-primary dark:text-slate-200">{nameB}:</span>{" "}
          <span className="text-pretty text-text-primary/95 dark:text-slate-300">{formatValues(valsB)}</span>
        </p>
      ) : null}
    </div>
  );
}
