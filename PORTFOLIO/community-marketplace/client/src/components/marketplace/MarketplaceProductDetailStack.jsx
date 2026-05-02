import { formatPesoWhole, listingCodAvailabilityLabel, parseSaleMetaFromDescription, removeSaleMetaLines } from "../../lib/listingSaleMeta.js";
import { ListingProductMetaExtras } from "./ListingProductMetaExtras.jsx";

/**
 * Same stack as community product cards: title, price (+ sale), quantity row, availability, description.
 * When `quantityAfterDescription` is true (cart / add modal), quantity renders after the description.
 * `quantityRow` is usually listing stock (browse) or an adjustable qty control (cart / add modal).
 * @param {"default" | "card"} [props.variant] — `card` uses stronger hierarchy for browse / community grids.
 * @param {boolean} [props.frameDescriptionAsSellerNote] — when true, description is shown in a labeled disclosure box (modal / detail).
 * @param {boolean} [props.hideAvailability] — omit the availability row (e.g. when the parent shows a compact fulfillment line on mobile).
 * @param {import("react").ReactNode} [props.titleEnd] — e.g. favorite control aligned with the title row (keeps imagery unobstructed).
 * @param {"gridMobile"|"listMobile"|null} [props.browseStackMode] — marketplace browse density on small screens (card variant only).
 * @param {string} [props.orderType] — `in_stock` | `pre_order` when listing exposes Add Product fields.
 */
export function MarketplaceProductDetailStack({
  title,
  priceCents,
  categoryLabel = "",
  description,
  fulfillmentModes,
  quantityRow,
  quantityAfterDescription = false,
  hideDescription = false,
  hideAvailability = false,
  variant = "default",
  frameDescriptionAsSellerNote = false,
  titleEnd = null,
  browseStackMode = null,
  orderType,
  processingTime,
  optionNameA,
  optionValuesA,
  optionNameB,
  optionValuesB,
  listingMetaDensity = "card",
  compactListMeta = false,
  uniformOrderDetailRows = false,
  uniformOrderDetailCompact = false,
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
      {compactListMeta ? (
        <p className="text-[12px] font-medium leading-snug text-text-secondary dark:text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-[10px] text-text-secondary/80 dark:text-slate-400">Fulfillment</span>
          <span className="mx-1 text-text-secondary/65 dark:text-slate-500">:</span>
          <span className="text-text-primary dark:text-slate-100">{availabilityLabel}</span>
        </p>
      ) : (
        <>
          <p className="product-meta-label">Fulfillment</p>
          <p className="product-meta-body">{availabilityLabel}</p>
        </>
      )}
    </div>
  ) : (
    <p className="text-xs text-text-secondary dark:text-slate-400">Availability: {availabilityLabel}</p>
  );

  const descriptionClampClass =
    browseStackMode === "listMobile" ? "line-clamp-4" : "line-clamp-3";

  const descriptionBlock = !hideDescription && descriptionPreview ? (
    isCard ? (
      <div
        className={`lm-card-meta ${
          browseStackMode === "listMobile" ? "px-3 py-2.5" : "px-2.5 py-2"
        }`}
      >
        <p className="product-meta-label">Details</p>
        <p className={`mt-1 ${descriptionClampClass} product-description-preview`}>{descriptionPreview}</p>
      </div>
    ) : frameDescriptionAsSellerNote ? (
      <div className="rounded-lg border border-amber-200/90 bg-amber-50/75 px-2.5 py-2 dark:border-amber-500/35 dark:bg-amber-500/10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">From the seller</p>
        <p className="mt-1 line-clamp-4 text-pretty text-xs leading-relaxed text-amber-950 dark:text-amber-50">{descriptionPreview}</p>
      </div>
    ) : (
      <p className="line-clamp-3 text-pretty text-xs leading-relaxed text-text-secondary min-[400px]:text-sm dark:text-slate-400">
        {descriptionPreview}
      </p>
    )
  ) : null;

  const metaStripCompact =
    browseStackMode === "gridMobile" && isCard && (quantityRow || (!hideAvailability && availabilityLabel)) ? (
      <div className="lm-product-card-meta space-y-1.5">
        {!hideAvailability && availabilityLabel ? (
          <p className="line-clamp-1 text-[11px] font-medium leading-tight text-text-secondary dark:text-slate-400">
            {availabilityLabel}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {categoryLabel ? (
            <span className="line-clamp-1 max-w-full rounded-md border border-amber-200/90 bg-amber-50/90 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-300">
              {categoryLabel}
            </span>
          ) : null}
          {quantityRow ? (
            <div className="min-w-0 shrink [&_.product-meta-label]:sr-only [&_.product-meta-value]:text-[11px] [&_.product-meta-value]:font-semibold [&_.product-meta-value]:text-text-primary/90 dark:[&_.product-meta-value]:text-slate-300">
              {qtyBlock}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  const metaStripDefault =
    isCard && (quantityRow || (!hideAvailability && availabilityLabel)) ? (
      <div className={`min-w-0 ${compactListMeta ? "space-y-1" : browseStackMode === "listMobile" ? "space-y-2" : "space-y-1.5"}`}>
        {!hideAvailability && availabilityLabel ? availabilityBlock : null}
        {qtyBlock}
      </div>
    ) : null;

  const metaStrip =
    browseStackMode === "gridMobile" && isCard ? metaStripCompact : metaStripDefault;

  const titleClass = isCard
    ? compactListMeta
      ? "line-clamp-1 min-w-0 break-words text-[14px] font-semibold leading-snug tracking-tight text-text-primary dark:text-slate-100 min-[390px]:text-[15px]"
      : browseStackMode === "gridMobile"
      ? "lm-product-card-title"
      : browseStackMode === "listMobile"
        ? "product-card-title min-[420px]:text-base"
        : "product-card-title"
    : "truncate text-sm font-semibold leading-snug text-text-primary dark:text-slate-100 min-[400px]:text-[15px]";

  const priceMainClass = isCard
    ? compactListMeta
      ? "text-[1.02rem] font-bold tabular-nums tracking-tight text-primary dark:text-brand-accent"
      : browseStackMode === "gridMobile"
      ? "lm-product-card-price"
      : "product-price"
    : "text-sm font-semibold tabular-nums text-text-primary dark:text-slate-200 min-[400px]:text-base";

  const rootGap =
    compactListMeta
      ? "space-y-1"
      : isCard && browseStackMode === "gridMobile"
      ? "space-y-2"
      : isCard && browseStackMode === "listMobile"
        ? "space-y-2.5"
        : isCard
          ? "space-y-2"
          : "space-y-1";

  return (
    <div className={`min-w-0 flex-1 ${rootGap}`}>
      {title ? (
        titleEnd ? (
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className={`${titleClass} min-w-0 flex-1`}>{title}</p>
            <div className="shrink-0 pt-0.5">{titleEnd}</div>
          </div>
        ) : (
          <p className={titleClass}>{title}</p>
        )
      ) : null}
      <div
        className={
          compactListMeta
            ? "flex min-w-0 items-center gap-1.5"
            : isCard && browseStackMode === "gridMobile"
            ? "lm-product-card-price-row"
            : "flex min-w-0 flex-wrap items-center gap-2"
        }
      >
        <p className={`min-w-0 ${priceMainClass}`}>{formatPesoWhole(priceCents)}</p>
        {originalPesos != null && originalPesos > currentPesos ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-[11px] font-medium text-text-secondary/85 line-through min-[380px]:text-xs dark:text-slate-500">
              ₱{originalPesos}
            </span>
            {saleMeta.percent ? (
              <span
                className={
                  browseStackMode === "gridMobile"
                    ? "lm-product-card-pill"
                    : "rounded-md border border-amber-300/80 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 min-[380px]:text-xs dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300"
                }
              >
                -{saleMeta.percent}%
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {isCard && browseStackMode === "gridMobile" ? (
        <div className="lm-product-card-badge-row">
          <ListingProductMetaExtras
            orderType={orderType}
            processingTime={processingTime}
            optionNameA={optionNameA}
            optionValuesA={optionValuesA}
            optionNameB={optionNameB}
            optionValuesB={optionValuesB}
            density="compact"
            uniformOrderDetailRows={uniformOrderDetailRows}
            uniformOrderDetailCompact={uniformOrderDetailCompact}
          />
        </div>
      ) : (
        <ListingProductMetaExtras
          orderType={orderType}
          processingTime={processingTime}
          optionNameA={optionNameA}
          optionValuesA={optionValuesA}
          optionNameB={optionNameB}
          optionValuesB={optionValuesB}
          density={!isCard ? "compact" : listingMetaDensity}
          uniformOrderDetailRows={uniformOrderDetailRows}
          uniformOrderDetailCompact={uniformOrderDetailCompact}
        />
      )}
      {quantityAfterDescription ? (
        <>
          {!hideAvailability && availabilityLabel ? availabilityBlock : null}
          {descriptionBlock}
          {qtyBlock}
        </>
      ) : isCard ? (
        <>
          {metaStrip}
          {browseStackMode !== "gridMobile" && categoryLabel ? (
            <div className="lm-product-card-badge-row">
              <span
                className={`line-clamp-1 max-w-full rounded-none border border-orange-300 bg-orange-100 py-0.5 leading-tight text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-300 ${
                  compactListMeta
                    ? "px-2 text-[11px] font-semibold"
                    : "px-2.5 text-xs font-semibold min-[380px]:text-[13px]"
                }`}
              >
                {categoryLabel}
              </span>
            </div>
          ) : null}
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
