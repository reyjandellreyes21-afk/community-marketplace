import { useState } from "react";
import { UI_KIT } from "../../lib/appUiKit.js";
import { SALE_PERCENT_OPTIONS } from "../../lib/listingSaleMeta.js";
import { MarketplaceProductDetailStack } from "./MarketplaceProductDetailStack.jsx";

export function CommunityShopListingCard({
  listing,
  gridMode,
  compactGrid = false,
  isFavorite,
  onAdd,
  onBuy,
  onToggleFavorite,
  showActions = false,
  showFavoriteIcon = true,
  currentUserId = "",
  onSaleSelect,
  onEdit,
  /** Opens read-only full description / details (browse, cart flow, favorites). */
  onInspect,
  /** When true, Buy now is disabled (e.g. sign-in or profile incomplete). */
  buyNowDisabled = false,
  buyNowDisabledReason = "",
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const imageUrl = String(listing.imageUrl || "").trim();
  const isOwner = String(listing.sellerId || "") === String(currentUserId || "");
  const stockQty = Math.max(0, Number(listing.quantity) || 0);
  const isOutOfStock = stockQty <= 0;

  const pad = gridMode && compactGrid ? "p-2.5" : "p-3.5";
  const imgBox =
    gridMode && compactGrid
      ? "h-28 w-full"
      : gridMode
        ? "h-48 w-full"
        : "h-32 w-32";
  const mainGap = gridMode && compactGrid ? "gap-2" : gridMode ? "gap-2.5" : "gap-3";

  return (
    <div
      className={`group relative rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary/35 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/75 ${pad} ${
        gridMode ? "flex h-full min-h-0 flex-col" : ""
      }`}
    >
      <div
        className={`flex min-h-0 ${gridMode ? `flex-1 flex-col ${mainGap}` : "flex-row items-start gap-3"}`}
      >
        <div className={`relative shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-700 dark:bg-slate-800 ${imgBox}`}>
          {!isOwner && showFavoriteIcon ? (
            <button
              type="button"
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200/90 bg-white text-rose-500 shadow-sm transition hover:scale-105 hover:text-rose-600 dark:border-slate-600 dark:bg-slate-900 dark:text-rose-400 dark:hover:text-rose-300"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.();
              }}
            >
              <span className="text-[1.45rem] leading-none">{isFavorite ? "♥" : "♡"}</span>
            </button>
          ) : null}
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title || "Product"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">No image</div>
          )}
        </div>
        <div
          className={`min-w-0 flex-1 ${gridMode ? `flex min-h-0 flex-col ${compactGrid ? "gap-1" : "gap-2"}` : "space-y-1"}`}
        >
          <MarketplaceProductDetailStack
            variant="card"
            title={listing.title || "Untitled product"}
            priceCents={listing.priceCents}
            description={listing.description}
            fulfillmentModes={listing.fulfillmentModes}
            quantityRow={
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-500">Stock</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-slate-100">{stockQty}</p>
                  {isOutOfStock ? (
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:border-rose-500/50 dark:bg-rose-950/30 dark:text-rose-300">
                      Out of stock
                    </span>
                  ) : null}
                </div>
              </div>
            }
            hideDescription={Boolean(gridMode && compactGrid)}
          />
          {listing.cityLabel ? <span className={UI_KIT.chipMuted}>{listing.cityLabel}</span> : null}
        </div>
      </div>
      {showActions ? (
        <div className={`flex flex-col gap-2 ${gridMode ? "mt-auto pt-3" : "mt-3"}`}>
          {onInspect ? (
            <button
              type="button"
              className="min-h-[44px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 sm:min-h-0 sm:py-1.5 sm:text-xs dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Read full description and details"
              onClick={(e) => {
                e.stopPropagation();
                onInspect();
              }}
            >
              View details
            </button>
          ) : null}
          {isOwner ? (
            <div className="flex w-full flex-col gap-2 min-[380px]:flex-row min-[380px]:items-stretch">
              <button
                type="button"
                className={`min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 sm:min-h-0 sm:py-1.5 sm:text-xs dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-950/35 ${
                  saleOpen ? "bg-amber-50 ring-2 ring-amber-400/40 dark:bg-amber-500/15 dark:ring-amber-400/30" : ""
                }`}
                title={saleOpen ? "Hide discount options" : "Apply a sale discount"}
                aria-expanded={saleOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setSaleOpen((prev) => !prev);
                }}
              >
                Sale
              </button>
              <button
                type="button"
                className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary/90 sm:min-h-0 sm:py-1.5 sm:text-xs dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90"
                title="Edit title, price, photos, and stock"
                aria-label={`Edit listing: ${listing.title || "product"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 min-[380px]:flex-row min-[380px]:items-stretch">
              <button
                type="button"
                title={isOutOfStock ? undefined : "Keep shopping — review cart anytime"}
                className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={isOutOfStock}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd?.();
                }}
              >
                {isOutOfStock ? "Unavailable" : "Add to cart"}
              </button>
              <button
                type="button"
                title={
                  isOutOfStock
                    ? undefined
                    : buyNowDisabled && buyNowDisabledReason
                      ? buyNowDisabledReason
                      : "Go to checkout — choose pickup or delivery"
                }
                aria-label={isOutOfStock ? "Out of stock" : "Buy now"}
                className={`min-h-[44px] flex-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition sm:min-h-0 sm:py-1.5 sm:text-xs dark:bg-brand-accent dark:text-slate-900 ${
                  isOutOfStock
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-brand-primary/90 dark:hover:bg-brand-accent/90"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={isOutOfStock}
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy?.();
                }}
              >
                {isOutOfStock ? "Out of stock" : "Buy now"}
              </button>
            </div>
          )}
        </div>
      ) : null}
      {showActions && isOwner && saleOpen ? (
        <div className={`overflow-x-auto ${gridMode ? "mt-2 shrink-0" : "mt-2"}`}>
          <div className="flex min-w-max items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            {SALE_PERCENT_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                onClick={(e) => {
                  e.stopPropagation();
                  onSaleSelect?.(percent);
                  setSaleOpen(false);
                }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
