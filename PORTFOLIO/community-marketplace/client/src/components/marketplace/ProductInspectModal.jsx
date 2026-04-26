import { useEffect, useState } from "react";

import {
  formatPesoWhole,
  listingCodAvailabilityLabel,
  removeSaleMetaLines,
  SALE_PERCENT_OPTIONS,
} from "../../lib/listingSaleMeta.js";

import { UI_KIT } from "../../lib/appUiKit.js";

/**
 * Read-only product detail: image, price, fulfillment, description, optional note.
 * Optional footer: buyer (Add to cart / Buy now) or seller (Sale / Edit). Dismiss: header ×, backdrop, or Esc (no duplicate Close in footer).
 */
export function ProductInspectModal({
  open,
  onClose,
  title,
  imageUrl = "",
  priceCents = 0,
  description = "",
  comment = "",
  /** When true, show the note section even if empty (e.g. cart / orders). */
  commentSectionRequired = false,
  commentHeading = "Note",
  fulfillmentModes,
  quantity = null,
  quantityLabel = "Quantity",
  subtitle = "",
  /** When set, used to disable buyer add/buy when out of stock. */
  listingStockQty = null,
  showBuyerCommerceActions = false,
  showSellerCommerceActions = false,
  onAddToCart,
  onBuyNow,
  onEditListing,
  onSaleSelect,
}) {
  const [salePickerOpen, setSalePickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setSalePickerOpen(false);
  }, [open]);

  if (!open) return null;

  const descPlain = removeSaleMetaLines(description);
  const commentTrim = String(comment || "").trim();
  const showCommentBlock = commentSectionRequired || commentTrim.length > 0;
  const availabilityLabel = fulfillmentModes ? listingCodAvailabilityLabel(fulfillmentModes) : "";
  const stock =
    listingStockQty != null && Number.isFinite(Number(listingStockQty)) ? Math.max(0, Number(listingStockQty)) : null;
  const isOutOfStock = stock != null && stock <= 0;
  const hasBuyerHandlers = showBuyerCommerceActions && (typeof onAddToCart === "function" || typeof onBuyNow === "function");
  const hasSellerHandlers =
    showSellerCommerceActions && (typeof onEditListing === "function" || typeof onSaleSelect === "function");
  const showActionFooter = hasBuyerHandlers || hasSellerHandlers;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-inspect-title"
      aria-describedby={showActionFooter ? "product-inspect-dismiss-hint" : undefined}
    >
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px] dark:bg-black/55"
        aria-label="Close product details"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(88dvh,42rem)] w-full max-w-lg flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] dark:border-slate-600 dark:bg-slate-900 sm:max-h-[min(90dvh,44rem)] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(15,23,42,0.22)] ${UI_KIT.surfaceFloating}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showActionFooter ? (
          <p id="product-inspect-dismiss-hint" className="sr-only">
            To dismiss without choosing an action, use the close control in the header, press Escape, or activate the dimmed area behind this dialog.
          </p>
        ) : null}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200/80 px-4 pb-2.5 pt-3 dark:border-slate-700/80 sm:px-5 sm:pb-3 sm:pt-4">
          <div className="min-w-0 pr-2">
            <h2
              id="product-inspect-title"
              className="text-base font-semibold leading-snug text-neutral-900 dark:text-slate-100 sm:text-lg"
            >
              {title || "Product"}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 text-lg leading-none text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={showActionFooter ? "Close product details" : "Close"}
            onClick={onClose}
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="mx-auto h-[8.5rem] w-full max-w-[12.5rem] shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800 sm:mx-0 sm:h-36 sm:w-36 sm:max-w-none">
              {String(imageUrl || "").trim() ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <p className="text-lg font-bold tabular-nums text-brand-primary dark:text-brand-accent sm:text-xl">
                {formatPesoWhole(priceCents)}
              </p>
              {availabilityLabel ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  <span className="font-semibold text-neutral-700 dark:text-slate-300">Fulfillment:</span>{" "}
                  {availabilityLabel}
                </p>
              ) : null}
              {quantity != null && Number.isFinite(Number(quantity)) ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  <span className="font-semibold text-neutral-700 dark:text-slate-300">{quantityLabel}:</span>{" "}
                  <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{Number(quantity)}</span>
                </p>
              ) : null}
              {stock != null ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  <span className="font-semibold text-neutral-700 dark:text-slate-300">Stock available:</span>{" "}
                  <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{stock}</span>
                  {isOutOfStock ? (
                    <span className="ml-2 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-300">
                      Out of stock
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
            <section
              className={`rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50 sm:p-3.5`}
            >
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                From the seller
              </h3>
              {descPlain ? (
                <p className="mt-1.5 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-neutral-800 dark:text-slate-200 sm:mt-2">
                  {descPlain}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-neutral-500 dark:text-slate-400 sm:mt-2">No description was provided.</p>
              )}
            </section>

            {showCommentBlock ? (
              <section className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-3 dark:border-sky-500/35 dark:bg-sky-950/25 sm:p-3.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  {commentHeading}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-sky-950 dark:text-sky-50 sm:mt-2">
                  {commentTrim && !/^n\/a$/i.test(commentTrim) ? commentTrim : "No note was left."}
                </p>
              </section>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200/80 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2.5 dark:border-slate-700/80 sm:px-5 sm:pb-4 sm:pt-3">
          {hasSellerHandlers ? (
            <div className="space-y-2">
              <div className="flex w-full flex-col gap-2 min-[340px]:flex-row min-[340px]:items-stretch min-[340px]:gap-2">
                {typeof onSaleSelect === "function" ? (
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-950/35 sm:min-h-10"
                    aria-expanded={salePickerOpen}
                    onClick={() => setSalePickerOpen((v) => !v)}
                  >
                    Sale
                  </button>
                ) : null}
                {typeof onEditListing === "function" ? (
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 sm:min-h-10"
                    onClick={() => onEditListing()}
                  >
                    Edit listing
                  </button>
                ) : null}
              </div>
              {salePickerOpen && typeof onSaleSelect === "function" ? (
                <div className="overflow-x-auto rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Quick discount
                  </p>
                  <div className="flex min-w-max flex-wrap gap-1.5">
                    {SALE_PERCENT_OPTIONS.map((percent) => (
                      <button
                        key={percent}
                        type="button"
                        className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        onClick={() => {
                          onSaleSelect(percent);
                          setSalePickerOpen(false);
                        }}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasBuyerHandlers ? (
            <div
              className={
                hasSellerHandlers ? "mt-2 border-t border-neutral-200/50 pt-2 dark:border-slate-700/40" : ""
              }
            >
              <div className="flex w-full flex-col gap-2 min-[340px]:flex-row min-[340px]:items-stretch min-[340px]:gap-2">
                {typeof onAddToCart === "function" ? (
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 sm:min-h-10"
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart()}
                  >
                    {isOutOfStock ? "Unavailable" : "Add to cart"}
                  </button>
                ) : null}
                {typeof onBuyNow === "function" ? (
                  <button
                    type="button"
                    className="min-h-10 flex-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-primary/15 transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-accent dark:text-slate-900 dark:shadow-none dark:hover:bg-brand-accent/90 sm:min-h-10"
                    disabled={isOutOfStock}
                    onClick={() => onBuyNow()}
                  >
                    {isOutOfStock ? "Out of stock" : "Buy now"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!showActionFooter ? (
            <div className="flex justify-stretch sm:justify-end">
              <button type="button" className="btn-primary touch-manipulation w-full sm:w-auto sm:min-w-[7rem]" onClick={onClose}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
