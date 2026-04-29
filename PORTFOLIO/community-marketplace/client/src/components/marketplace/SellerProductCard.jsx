import { useEffect, useState } from "react";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
import { ListingProductMetaExtras } from "./ListingProductMetaExtras.jsx";
import {
  formatPesoWhole,
  listingCodAvailabilityLabel,
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  SALE_PERCENT_OPTIONS,
} from "../../lib/listingSaleMeta.js";

function IconEye({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPencil({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7 21l-4 1 1-4 12.5-12.5Z" />
      <path d="m13 7 4 4" />
    </svg>
  );
}

function IconTag({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2H2v9.59a2 2 0 0 0 .59 1.41l10 10a2 2 0 0 0 2.82 0l7.59-7.59a2 2 0 0 0 0-2.82L13.41 2.59A2 2 0 0 0 12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SellerProductCard({
  listing,
  gridMode,
  compactGrid = false,
  onSaleSelect,
  onEdit,
  onDelete,
  onAdjustQuantity,
  onSetQuantity,
  quantityUpdating = false,
  onView,
  onNotifyQuantityRequired,
  /** Mobile: hide card action buttons; tap image to open full details (inspect modal). */
  mobileCardUx = false,
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [qtyDraft, setQtyDraft] = useState("");
  const normalizedStatus = String(listing.status || "").toLowerCase();
  const statusClass =
    normalizedStatus === "active"
      ? "bg-green-100 text-green-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300";
  const listedQtyForBadge = Math.max(0, Number(listing?.quantity) || 0);
  const isOutOfStock = listedQtyForBadge === 0;
  const statusBadgeLabel = isOutOfStock ? "Out of stock" : normalizedStatus || "unknown";
  const statusBadgeClass = isOutOfStock
    ? "bg-gray-100 text-gray-600 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-100"
    : statusClass;
  const availabilityLabel = listingCodAvailabilityLabel(listing.fulfillmentModes);
  const saleMeta = parseSaleMetaFromDescription(listing.description);
  const currentPesos = Math.floor((Number(listing.priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta.originalPesos)) ? Number(saleMeta.originalPesos) : null;
  const descriptionPreview = removeSaleMetaLines(listing.description);

  useEffect(() => {
    setQtyDraft("");
  }, [listing?.id]);

  const tryCommitQuantityDraft = () => {
    const raw = String(qtyDraft ?? "").trim();
    if (raw === "") {
      onNotifyQuantityRequired?.();
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      onNotifyQuantityRequired?.();
      return;
    }
    onSetQuantity?.(Math.floor(n));
    setQtyDraft("");
  };

  const isComfortableGrid = gridMode && !compactGrid;
  const isListLayout = !gridMode;
  /** Shell styles: list = wide management row; grid = catalog card; dense = compact inventory tile. */
  const cardShellClass = isListLayout
    ? "lm-card bg-surface p-3 transition duration-200 ease-in-out dark:bg-[#0f2234] md:p-3.5 md:hover:shadow-md md:dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
    : compactGrid
      ? "lm-card bg-background p-2.5 transition duration-200 ease-in-out dark:bg-[#0f2234] md:p-3 md:ring-1 md:ring-border/25 md:hover:shadow-md md:dark:ring-[#1f3c56]/45"
      : "lm-card bg-surface p-3 transition duration-200 ease-in-out dark:bg-[#0f2234] md:p-3.5 md:ring-1 md:ring-border/50 md:hover:shadow-md md:dark:ring-[#1f3c56]/50";
  /** List + comfortable grid: larger ± / input on small screens only. */
  const qtyTouchFriendly = isComfortableGrid || isListLayout;
  /** Dense: full-width cards on mobile — use comfortable touch/stacked qty below sm only. */
  const qtyMobileExpanded = (qtyTouchFriendly && !compactGrid) || compactGrid;
  const imgBox =
    gridMode && compactGrid
      ? "h-28 w-full md:h-24 md:h-[5.75rem]"
      : gridMode
        ? isComfortableGrid
          ? "h-44 w-full md:h-48 md:h-52"
          : "h-36 w-full md:h-44 md:h-48"
        : "h-24 w-24 shrink-0 md:h-32 md:w-32";
  const mainGap = gridMode && compactGrid ? "gap-1 md:gap-1.5" : gridMode ? "gap-3 md:gap-3.5" : "gap-3";
  /** Comfortable grid & list: 44px ± on mobile; dense uses 44px below sm then compact sizes. */
  const qtyBtn =
    qtyTouchFriendly && !compactGrid
      ? "inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-neutral-300 bg-white text-base font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:h-7 md:w-7 md:rounded-md md:text-xs"
      : "inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-md border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 md:h-7 md:w-7 md:text-xs";

  const denseStepMinusPlus =
    "inline-flex min-h-[44px] min-w-[2.75rem] shrink-0 touch-manipulation items-center justify-center border-0 bg-neutral-50/95 text-[15px] font-semibold leading-none text-neutral-800 transition hover:bg-neutral-100 active:bg-neutral-200/80 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700 dark:active:bg-slate-700 md:min-h-0 md:h-8 md:w-8 md:text-sm";
  const denseQtyInput =
    "input-base min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-1.5 text-center text-[13px] font-semibold tabular-nums text-neutral-900 outline-none ring-0 focus:ring-0 dark:text-slate-100 md:h-8 md:min-h-0 md:px-1 md:text-[12px]";
  const denseApplyBtn =
    "inline-flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-400/90 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 md:min-h-8 md:min-w-8";

  const denseIconNeutral =
    "inline-flex h-8 w-full min-h-[44px] touch-manipulation items-center justify-center rounded-md border border-slate-300/90 bg-white px-0 py-0 text-slate-800 shadow-sm transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-100 dark:hover:bg-slate-800 md:h-7 md:min-h-0 [&_svg]:h-[14px] [&_svg]:w-[14px]";
  const denseIconDanger =
    "inline-flex h-8 w-full min-h-[44px] touch-manipulation items-center justify-center rounded-md border border-rose-500/90 bg-rose-50 px-0 py-0 text-rose-800 shadow-sm transition hover:bg-rose-100 active:scale-[0.98] dark:border-rose-500/55 dark:bg-rose-950/45 dark:text-rose-100 dark:hover:bg-rose-950/70 md:h-7 md:min-h-0 [&_svg]:h-[14px] [&_svg]:w-[14px]";

  const listActionBtn = (variant) => {
    const base =
      "flex w-full min-w-0 items-center justify-center rounded-lg border font-semibold transition touch-manipulation min-h-[44px] py-2.5 px-3 text-xs md:min-h-0 md:py-2 md:px-3 md:text-xs";
    const neutral =
      "border-primary bg-surface text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65)] hover:bg-primary-soft dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-100 dark:shadow-none dark:hover:bg-slate-800";
    const danger =
      "border-danger bg-danger text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55)] hover:bg-danger-hover dark:border-rose-500/55 dark:bg-rose-950/45 dark:text-rose-100 dark:shadow-none dark:hover:bg-rose-950/60";
    return `${base} ${variant === "danger" ? danger : neutral}`;
  };

  const gridActionPad = isComfortableGrid
    ? "px-3 py-2.5 text-xs md:py-1.5 md:px-2.5 md:py-2 md:text-xs"
    : compactGrid
      ? "min-h-[44px] touch-manipulation py-2.5 px-2.5 text-[11px] md:min-h-0 md:py-1.5 md:px-2 md:py-1 md:text-[10px]"
      : "px-3 py-1.5 text-xs";

  const gridNeutral = `rounded-xl border font-semibold transition duration-200 ease-in-out ${gridActionPad} border-primary bg-surface text-primary hover:bg-primary-soft dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-100 dark:hover:bg-slate-800`;
  const gridDanger = `rounded-xl border font-semibold transition duration-200 ease-in-out ${gridActionPad} border-danger bg-danger text-white hover:bg-danger-hover dark:border-rose-500/55 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55`;

  const qtyRowClass = qtyMobileExpanded
    ? "flex w-full min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-1.5"
    : "flex w-full min-w-0 flex-wrap items-center gap-1.5";
  const qtyInputWrapClass = qtyMobileExpanded
    ? compactGrid
      ? "flex min-h-[44px] min-w-0 flex-1 items-stretch gap-2 md:h-8 md:min-h-0 md:max-w-[11rem] md:items-center md:gap-1"
      : "flex min-h-[44px] min-w-0 flex-1 items-stretch gap-2 md:min-h-0 md:max-w-[11rem] md:items-center md:gap-1"
    : "flex min-w-0 flex-1 basis-[8rem] items-center gap-1 md:basis-auto md:max-w-[11rem]";
  const qtyInputClass = qtyMobileExpanded
    ? compactGrid
      ? "input-base min-h-[44px] min-w-0 flex-1 rounded-lg px-3 text-center text-sm tabular-nums text-neutral-700 dark:text-slate-200 md:h-8 md:min-h-0 md:rounded-md md:text-[11px]"
      : "input-base min-h-[44px] min-w-0 flex-1 rounded-lg px-3 text-center text-sm tabular-nums text-neutral-700 dark:text-slate-200 md:h-7 md:min-h-0 md:rounded-md md:text-[11px]"
    : "input-base h-8 min-w-0 flex-1 rounded-md px-2 text-center text-xs tabular-nums text-neutral-700 dark:text-slate-200 md:h-7 md:text-[11px]";
  const qtySetClass = qtyMobileExpanded
    ? compactGrid
      ? "btn-secondary min-h-[44px] shrink-0 touch-manipulation whitespace-nowrap px-4 text-xs font-semibold md:h-8 md:min-h-0 md:px-2 md:py-0"
      : "btn-secondary min-h-[44px] shrink-0 touch-manipulation whitespace-nowrap px-4 text-xs font-semibold md:h-7 md:min-h-0 md:px-2 md:py-0"
    : "btn-secondary shrink-0 whitespace-nowrap px-2 py-1 text-[10px] font-semibold md:h-7 md:px-2 md:py-0";

  const descClamp =
    compactGrid
      ? "line-clamp-1 md:line-clamp-2"
      : gridMode
        ? isComfortableGrid
          ? "line-clamp-2 md:line-clamp-3 lg:line-clamp-4"
          : "line-clamp-2 md:line-clamp-3"
        : "line-clamp-2 md:line-clamp-3";

  const innerBody = (
    <>
      {isListLayout ? (
        <div className="flex min-w-0 items-start gap-2">
          <p className="min-w-0 flex-1 text-pretty text-sm font-semibold leading-snug text-neutral-900 dark:text-slate-100 md:text-base">{listing.title || "Untitled product"}</p>
          <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass}`}>{statusBadgeLabel}</span>
        </div>
      ) : compactGrid ? (
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-neutral-900 dark:text-slate-100">
            {listing.title || "Untitled product"}
          </p>
          <span className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass}`}>{statusBadgeLabel}</span>
        </div>
      ) : (
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold leading-snug text-neutral-900 dark:text-slate-100 md:text-[1.0625rem]">
            {listing.title || "Untitled product"}
          </p>
          <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass}`}>{statusBadgeLabel}</span>
        </div>
      )}
      <div className={`flex min-w-0 flex-wrap items-center gap-2 ${isComfortableGrid ? "md:gap-2.5" : ""}`}>
        <p
          className={`min-w-0 font-semibold text-neutral-800 dark:text-slate-200 ${isComfortableGrid ? "text-base md:text-lg" : compactGrid ? "text-sm tabular-nums" : "text-sm"}`}
        >
          {formatPesoWhole(listing.priceCents)}
        </p>
        {originalPesos != null && originalPesos > currentPesos ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">₱{originalPesos}</span>
            {saleMeta.percent ? (
              <span className="rounded-full border border-rose-300/90 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                -{saleMeta.percent}%
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ListingProductMetaExtras
        orderType={listing.orderType}
        processingTime={listing.processingTime}
        optionNameA={listing.optionNameA}
        optionValuesA={listing.optionValuesA}
        optionNameB={listing.optionNameB}
        optionValuesB={listing.optionValuesB}
        density={compactGrid ? "compact" : "card"}
      />
      <p
        className={`mt-1 text-xs text-neutral-600 dark:text-slate-400 ${isComfortableGrid ? "md:text-[13px]" : ""} ${isListLayout ? "md:text-[13px]" : ""} ${compactGrid ? "text-[11px]" : ""}`}
      >
        <span className="font-medium text-neutral-700 dark:text-slate-300">Current quantity:</span>{" "}
        <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{listedQtyForBadge}</span>
      </p>
      <div className="w-full min-w-0 space-y-2 text-xs text-neutral-600 dark:text-slate-400">
        {compactGrid ? (
          <div className="flex w-full min-w-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">Qty</span>
              {quantityUpdating ? <span className="text-[10px] font-medium text-neutral-500 dark:text-slate-500">Saving…</span> : null}
            </div>
            <div className="flex min-w-0 items-stretch gap-1">
              <div className="flex min-h-[40px] min-w-0 flex-1 overflow-hidden rounded-lg border-0 bg-white shadow-none ring-1 ring-neutral-200/55 dark:bg-[#11283d] dark:ring-[#1f3c56]/50 md:min-h-8 md:border md:border-neutral-300/95 md:shadow-sm md:ring-0 dark:md:border-[#1f3c56] dark:md:ring-0">
                <button
                  type="button"
                  className={`${denseStepMinusPlus} rounded-none border-r border-neutral-200 dark:border-slate-700`}
                  disabled={quantityUpdating || (Number(listing.quantity) || 0) <= 0}
                  onClick={() => onAdjustQuantity?.(-1)}
                  aria-label="Decrease product quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className={denseQtyInput}
                  value={qtyDraft}
                  disabled={quantityUpdating}
                  onChange={(e) => {
                    const digits = String(e.target.value || "").replace(/[^\d]/g, "");
                    setQtyDraft(digits);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    tryCommitQuantityDraft();
                  }}
                  aria-label="Set product quantity"
                />
                <button
                  type="button"
                  className={`${denseStepMinusPlus} rounded-none border-l border-neutral-200 dark:border-slate-700`}
                  disabled={quantityUpdating}
                  onClick={() => onAdjustQuantity?.(1)}
                  aria-label="Increase product quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={denseApplyBtn}
                disabled={quantityUpdating}
                title="Apply quantity"
                aria-label="Apply quantity"
                onClick={() => tryCommitQuantityDraft()}
              >
                <IconCheck className="h-[18px] w-[18px] md:h-3.5 md:w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={
              isListLayout
                ? `${qtyRowClass} md:items-center md:gap-2`
                : isComfortableGrid
                  ? `${qtyRowClass} md:items-center md:gap-2`
                  : qtyRowClass
            }
          >
            {isListLayout ? (
              <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500 md:inline-block">Listed qty</span>
            ) : null}
            {isComfortableGrid ? (
              <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500 md:inline-block">Listed qty</span>
            ) : null}
            <div className="inline-flex shrink-0 items-center gap-1">
              <button type="button" className={qtyBtn} disabled={quantityUpdating || (Number(listing.quantity) || 0) <= 0} onClick={() => onAdjustQuantity?.(-1)} aria-label="Decrease product quantity">
                −
              </button>
              <button type="button" className={qtyBtn} disabled={quantityUpdating} onClick={() => onAdjustQuantity?.(1)} aria-label="Increase product quantity">
                +
              </button>
            </div>
            <div className={qtyInputWrapClass}>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className={qtyInputClass}
                value={qtyDraft}
                disabled={quantityUpdating}
                onChange={(e) => {
                  const digits = String(e.target.value || "").replace(/[^\d]/g, "");
                  setQtyDraft(digits);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  tryCommitQuantityDraft();
                }}
                aria-label="Set product quantity"
              />
              <button
                type="button"
                className={qtySetClass}
                disabled={quantityUpdating}
                onClick={() => tryCommitQuantityDraft()}
                aria-label="Apply quantity"
              >
                Set
              </button>
            </div>
            {isListLayout && quantityUpdating ? (
              <span className="hidden text-[10px] font-medium text-neutral-500 dark:text-slate-400 md:ml-auto md:inline md:shrink-0">Saving…</span>
            ) : null}
            {isComfortableGrid && quantityUpdating ? (
              <span className="hidden text-[10px] font-medium text-neutral-500 dark:text-slate-400 md:ml-auto md:inline md:shrink-0">Saving…</span>
            ) : null}
          </div>
        )}
      </div>
      <p
        className={`leading-snug text-neutral-600 dark:text-slate-400 ${isListLayout || compactGrid ? "text-[11px] md:text-xs" : "text-xs"} ${isComfortableGrid ? "md:text-[13px]" : ""} ${isListLayout ? "md:text-[13px]" : ""} ${compactGrid ? "truncate md:text-[11px]" : ""}`}
      >
        <span className={`font-medium text-neutral-700 dark:text-slate-300 ${isComfortableGrid ? "text-neutral-800 dark:text-slate-200" : ""}`}>Availability</span>
        <span className={isListLayout || compactGrid ? "hidden md:inline" : ""}>: </span>
        <span
          className={`${isListLayout || compactGrid ? "mt-0.5 block md:mt-0 md:inline" : ""} ${isListLayout ? "md:text-neutral-600 dark:md:text-slate-400" : ""} ${compactGrid ? "md:inline" : ""} ${isComfortableGrid ? "md:inline" : ""}`}
        >
          {availabilityLabel}
        </span>
      </p>
      {descriptionPreview && !compactGrid ? (
        <p className={`text-pretty break-words text-xs leading-relaxed text-neutral-600 dark:text-slate-400 ${descClamp} ${isComfortableGrid ? "md:text-[13px] md:leading-snug" : ""}`}>{descriptionPreview}</p>
      ) : null}
    </>
  );

  const sellerActionsExpanded = (
    <>
      {onView ? (
        <button type="button" className={isListLayout ? listActionBtn() : gridNeutral} title="Read full description" onClick={() => onView()}>
          View
        </button>
      ) : null}
      <button type="button" className={isListLayout ? listActionBtn() : gridNeutral} onClick={onEdit}>
        Edit
      </button>
      <button type="button" className={isListLayout ? listActionBtn() : gridNeutral} onClick={() => setSaleOpen((prev) => !prev)}>
        Sale
      </button>
      <button type="button" className={isListLayout ? listActionBtn("danger") : gridDanger} onClick={onDelete}>
        Delete
      </button>
    </>
  );

  const mobileImageInspect = Boolean(mobileCardUx && onView);
  const imageInspectBtnClass =
    "lm-product-card--tap absolute inset-0 z-0 min-h-0 w-full border-0 bg-transparent p-0 text-left";

  const sellerActionsDense = (
    <>
      {onView ? (
        <button type="button" className={denseIconNeutral} title="View product" aria-label="View product" onClick={() => onView()}>
          <IconEye />
        </button>
      ) : null}
      <button type="button" className={denseIconNeutral} title="Edit listing" aria-label="Edit listing" onClick={onEdit}>
        <IconPencil />
      </button>
      <button
        type="button"
        className={`${denseIconNeutral} ${saleOpen ? "ring-1 ring-amber-400/70 ring-offset-1 ring-offset-white dark:ring-amber-500/55 dark:ring-offset-slate-900" : ""}`}
        title={saleOpen ? "Close sale options" : "Sale or discount"}
        aria-label={saleOpen ? "Close sale options" : "Sale or discount"}
        aria-expanded={saleOpen}
        onClick={() => setSaleOpen((prev) => !prev)}
      >
        <IconTag />
      </button>
      <button type="button" className={denseIconDanger} title="Delete listing" aria-label="Delete listing" onClick={onDelete}>
        <IconTrash />
      </button>
    </>
  );

  return (
    <li
      className={`min-w-0 overflow-hidden ${gridMode ? "lm-grid-card lm-product-card-grid" : "lm-list-card lm-product-card-list"} ${cardShellClass} ${gridMode ? "h-full" : ""}`}
    >
      {isListLayout ? (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 gap-3">
            <div className={`relative ${imgBox}`}>
              {mobileImageInspect ? (
                <button
                  type="button"
                  className={imageInspectBtnClass}
                  aria-label={`View details: ${listing.title || "product"}`}
                  onClick={() => onView()}
                >
                  <ProductListingMedia
                    listing={listing}
                    variant="list"
                    className="pointer-events-none absolute inset-0 min-h-0"
                    sizes="(max-width: 768px) 42vw, min(240px, 18vw)"
                    loading="lazy"
                  />
                </button>
              ) : (
                <ProductListingMedia
                  listing={listing}
                  variant="list"
                  className="absolute inset-0 min-h-0"
                  sizes="(max-width: 768px) 42vw, min(240px, 18vw)"
                  loading="lazy"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">{innerBody}</div>
          </div>
          {!mobileCardUx ? (
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 border-t border-neutral-200/90 pt-3 dark:border-[#1f3c56]/80 md:grid-cols-4 md:gap-2">
              {sellerActionsExpanded}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`flex min-w-0 flex-col ${mainGap} ${isComfortableGrid || compactGrid ? "md:h-full" : ""}`}>
          <div className={`relative ${imgBox}`}>
            {mobileImageInspect ? (
              <button
                type="button"
                className={imageInspectBtnClass}
                aria-label={`View details: ${listing.title || "product"}`}
                onClick={() => onView()}
              >
                <ProductListingMedia
                  listing={listing}
                  variant="grid"
                  fillFrame
                  className="pointer-events-none absolute inset-0 min-h-0"
                  sizes="(max-width: 768px) 42vw, min(240px, 18vw)"
                  loading="lazy"
                />
              </button>
            ) : (
              <ProductListingMedia
                listing={listing}
                variant="grid"
                fillFrame
                className="absolute inset-0 min-h-0"
                sizes="(max-width: 768px) 42vw, min(240px, 18vw)"
                loading="lazy"
              />
            )}
          </div>
          <div className={`min-w-0 flex-1 space-y-1.5 ${isComfortableGrid || compactGrid ? "md:flex md:min-h-0 md:flex-col" : ""}`}>{innerBody}</div>
          {!mobileCardUx ? (
            <div
              className={
                isComfortableGrid
                  ? "mt-auto grid w-full min-w-0 shrink-0 grid-cols-2 gap-2 self-stretch md:gap-2 md:gap-2 [&>button]:min-h-[44px] [&>button]:touch-manipulation md:[&>button]:min-h-0 md:[&>button]:min-h-0"
                  : compactGrid
                    ? "mt-auto grid w-full min-w-0 shrink-0 grid-cols-2 gap-1 self-stretch md:gap-1 [&>button]:touch-manipulation"
                    : "grid w-full min-w-0 grid-cols-2 gap-1.5 self-stretch md:gap-2"
              }
            >
              {compactGrid ? sellerActionsDense : sellerActionsExpanded}
            </div>
          ) : null}
        </div>
      )}
      {!mobileCardUx && saleOpen ? (
        <div className={`overflow-x-auto ${compactGrid ? "mt-2" : "mt-3"}`}>
          <div
            className={`flex min-w-max items-center rounded-lg border border-amber-200/80 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10 ${compactGrid ? "gap-1 p-1.5" : "gap-1.5 rounded-xl p-2"}`}
          >
            {SALE_PERCENT_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                className={`touch-manipulation rounded-md border border-amber-300/90 bg-white font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30 ${compactGrid ? "min-h-9 min-w-[2.25rem] px-1.5 py-0.5 text-[11px] md:min-h-0 md:min-w-0" : "min-h-10 min-w-[2.75rem] px-2 py-1 text-xs md:min-h-0 md:min-w-0"}`}
                onClick={() => {
                  onSaleSelect(percent);
                  setSaleOpen(false);
                }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
