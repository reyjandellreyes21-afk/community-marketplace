import { formatPesoWhole, listingCodAvailabilityLabel, parseSaleMetaFromDescription, removeSaleMetaLines } from "../../lib/listingSaleMeta.js";

/**
 * Same stack as community product cards: title, price (+ sale), quantity row, availability, description.
 * When `quantityAfterDescription` is true (cart / add modal), quantity renders after the description.
 * `quantityRow` is usually listing stock (browse) or an adjustable qty control (cart / add modal).
 * @param {"default" | "card"} [props.variant] — `card` uses stronger hierarchy for browse / community grids.
 * @param {boolean} [props.frameDescriptionAsSellerNote] — when true, description is shown in a labeled disclosure box (modal / detail).
 * @param {boolean} [props.hideAvailability] — omit the availability row (e.g. when the parent shows a compact fulfillment line on mobile).
 */
export function MarketplaceProductDetailStack({
  title,
  priceCents,
  description,
  fulfillmentModes,
  quantityRow,
  quantityAfterDescription = false,
  hideDescription = false,
  hideAvailability = false,
  variant = "default",
  frameDescriptionAsSellerNote = false,
}) {
  const saleMeta = parseSaleMetaFromDescription(description);
  const currentPesos = Math.floor((Number(priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(description);
  const availabilityLabel = listingCodAvailabilityLabel(fulfillmentModes);
  const isCard = variant === "card";

  const qtyBlock = quantityRow ? <div className={isCard ? "" : "pt-0.5"}>{quantityRow}</div> : null;

  const availabilityBlock = isCard ? (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary dark:text-slate-500">Fulfillment</p>
      <p className="mt-0.5 text-xs font-medium text-text-primary dark:text-slate-200">{availabilityLabel}</p>
    </div>
  ) : (
    <p className="text-xs text-text-secondary dark:text-slate-400">Availability: {availabilityLabel}</p>
  );

  const descriptionBlock = !hideDescription && descriptionPreview ? (
    isCard ? (
      <div className="rounded-xl border border-border bg-background px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/40">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary dark:text-slate-500">Details</p>
        <p className="mt-1 line-clamp-3 text-pretty text-xs leading-relaxed text-text-secondary dark:text-slate-300">{descriptionPreview}</p>
      </div>
    ) : frameDescriptionAsSellerNote ? (
      <div className="rounded-lg border border-amber-200/90 bg-amber-50/75 px-2.5 py-2 dark:border-amber-500/35 dark:bg-amber-500/10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">From the seller</p>
        <p className="mt-1 line-clamp-4 text-pretty text-xs leading-relaxed text-amber-950 dark:text-amber-50">{descriptionPreview}</p>
      </div>
    ) : (
      <p className="line-clamp-3 text-pretty text-xs leading-relaxed text-text-secondary dark:text-slate-400">{descriptionPreview}</p>
    )
  ) : null;

  const metaStrip =
    isCard && (quantityRow || availabilityLabel) ? (
      <div className="rounded-xl border border-border bg-background px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
          {qtyBlock}
          {availabilityLabel ? availabilityBlock : null}
        </div>
      </div>
    ) : null;

  const titleClass = isCard
    ? "truncate text-base font-semibold leading-snug tracking-tight text-text-primary dark:text-slate-100"
    : "truncate text-sm font-semibold text-text-primary dark:text-slate-100";

  const priceMainClass = isCard
    ? "text-lg font-bold tabular-nums text-primary dark:text-brand-accent"
    : "text-sm font-semibold text-text-primary dark:text-slate-200";

  return (
    <div className={`min-w-0 flex-1 ${isCard ? "space-y-2" : "space-y-1"}`}>
      {title ? <p className={titleClass}>{title}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className={priceMainClass}>{formatPesoWhole(priceCents)}</p>
        {originalPesos != null && originalPesos > currentPesos ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-text-secondary line-through dark:text-slate-400">₱{originalPesos}</span>
            {saleMeta.percent ? (
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                -{saleMeta.percent}%
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {quantityAfterDescription ? (
        <>
          {availabilityBlock}
          {descriptionBlock}
          {qtyBlock}
        </>
      ) : isCard ? (
        <>
          {metaStrip}
          {descriptionBlock}
        </>
      ) : (
        <>
          {qtyBlock}
          {!hideAvailability && availabilityLabel ? availabilityBlock : null}
          {descriptionBlock}
        </>
      )}
    </div>
  );
}
