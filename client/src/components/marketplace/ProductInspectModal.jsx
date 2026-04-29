import { useEffect, useMemo, useState } from "react";

import {
  formatPesoWhole,
  normalizeListingOptionValues,
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  SALE_PERCENT_OPTIONS,
} from "../../lib/listingSaleMeta.js";

import { UI_KIT } from "../../lib/appUiKit.js";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
import { ListingProductMetaExtras } from "./ListingProductMetaExtras.jsx";

function dedupeListingGalleryUrls(primary, extraUrls) {
  const seen = new Set();
  const out = [];
  const push = (u) => {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(primary);
  if (Array.isArray(extraUrls)) {
    for (const u of extraUrls) push(u);
  }
  return out.slice(0, 12);
}

/**
 * Read-only product detail: gallery, pricing, listing fields aligned with upload form (category, fulfillment,
 * order type, processing, variants), description, optional note.
 * Optional footer: buyer (Add to cart / Buy now) or seller (Sale / Edit). Dismiss: header ×, backdrop, or Esc.
 */
export function ProductInspectModal({
  open,
  fullScreen = false,
  onClose,
  title,
  imageUrl = "",
  /** Additional listing photos (same order as seller gallery when provided). */
  imageUrls = [],
  priceCents = 0,
  description = "",
  sellerUsername = "",
  sellerAddressLine = "",
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
  onViewSellerProfile,
  buyNowDisabled = false,
  buyNowDisabledReason = "",
  orderType,
  processingTime,
  optionNameA,
  optionValuesA,
  optionNameB,
  optionValuesB,
  /** From `getListingCategoryShortLabel(verticalId, subId)` — same as upload category. */
  categoryLabel = "",
  isFavorite = false,
  onToggleFavorite,
}) {
  const [salePickerOpen, setSalePickerOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewLoadFailed, setImagePreviewLoadFailed] = useState(false);
  const [galleryThumbIdx, setGalleryThumbIdx] = useState(0);

  const galleryUrls = useMemo(
    () => dedupeListingGalleryUrls(imageUrl, imageUrls),
    [imageUrl, imageUrls]
  );
  const displayImageUrl = galleryUrls[galleryThumbIdx] || galleryUrls[0] || "";
  const saleMeta = parseSaleMetaFromDescription(description);
  const currentPesos = Math.floor((Number(priceCents) || 0) / 100);
  const originalPesos = Number.isFinite(Number(saleMeta?.originalPesos)) ? Number(saleMeta.originalPesos) : null;

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

  useEffect(() => {
    if (!open) setImagePreviewOpen(false);
  }, [open]);

  useEffect(() => {
    if (imagePreviewOpen) setImagePreviewLoadFailed(false);
  }, [imagePreviewOpen, displayImageUrl]);

  useEffect(() => {
    if (!open) return;
    setGalleryThumbIdx(0);
  }, [open, galleryUrls.join("|")]);

  if (!open) return null;

  const descPlain = removeSaleMetaLines(description);
  const sellerUsernameTrim = String(sellerUsername || "").trim();
  const sellerAddressLineTrim = String(sellerAddressLine || "").trim();
  const hasSellerDetails = sellerUsernameTrim.length > 0 || sellerAddressLineTrim.length > 0;
  const commentTrim = String(comment || "").trim();
  const showCommentBlock = commentSectionRequired || commentTrim.length > 0;
  const stock =
    listingStockQty != null && Number.isFinite(Number(listingStockQty)) ? Math.max(0, Number(listingStockQty)) : null;
  const isOutOfStock = stock != null && stock <= 0;
  const quantityNumber = quantity != null && Number.isFinite(Number(quantity)) ? Number(quantity) : null;
  const showQuantityLine = quantityNumber != null;
  const quantityLabelNorm = String(quantityLabel || "").trim().toLowerCase();
  const isQuantityStockLine =
    quantityLabelNorm === "stock listed" || quantityLabelNorm === "stock available" || quantityLabelNorm === "stock";
  const hideStockAvailableAsDuplicate = showQuantityLine && stock != null && isQuantityStockLine && quantityNumber === stock;
  const hasBuyerHandlers = showBuyerCommerceActions && (typeof onAddToCart === "function" || typeof onBuyNow === "function");
  const hasSellerHandlers =
    showSellerCommerceActions && (typeof onEditListing === "function" || typeof onSaleSelect === "function");
  const showActionFooter = hasBuyerHandlers || hasSellerHandlers;

  const fulfillmentModesArr = Array.isArray(fulfillmentModes) ? fulfillmentModes : [];
  const offersPickup = fulfillmentModesArr.includes("pickup");
  const offersDelivery = fulfillmentModesArr.includes("delivery");
  const categoryTrim = String(categoryLabel || "").trim();
  const orderTypeNorm = String(orderType || "in_stock").trim();
  const processingTrim = String(processingTime || "").trim();
  const orderTypeReadable = orderTypeNorm === "pre_order" ? "Pre-order" : "In stock";
  const processingLabel =
    orderTypeNorm === "pre_order"
      ? "Lead / processing time"
      : processingTrim
        ? "Estimated ready time"
        : "";
  const nameATrim = String(optionNameA || "").trim();
  const nameBTrim = String(optionNameB || "").trim();
  const variantValsA = normalizeListingOptionValues(optionValuesA);
  const variantValsB = normalizeListingOptionValues(optionValuesB);
  const hasVariantDetailRows =
    (Boolean(nameATrim) && variantValsA.length > 0) || (Boolean(nameBTrim) && variantValsB.length > 0);

  return (
    <div
      className={
        fullScreen
          ? "w-full"
          : "fixed inset-0 z-[95] flex items-end justify-center p-0 md:items-center md:p-4"
      }
      role={fullScreen ? "region" : "dialog"}
      aria-modal={fullScreen ? undefined : "true"}
      aria-labelledby="product-inspect-title"
      aria-describedby={showActionFooter ? "product-inspect-dismiss-hint" : undefined}
    >
      {!fullScreen ? (
        <button
          type="button"
          className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px] dark:bg-black/55"
          aria-label="Close product details"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`relative z-10 flex w-full flex-col ${
          fullScreen
            ? "mx-auto min-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-w-screen-lg rounded-none border-0 bg-white shadow-none dark:bg-slate-950"
            : "max-h-[min(88dvh,42rem)] max-w-lg rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] dark:border-[#1f3c56] dark:bg-[#0f2234] md:max-h-[min(90dvh,44rem)] md:rounded-2xl md:shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        } ${UI_KIT.surfaceFloating}`}
        onClick={(e) => e.stopPropagation()}
      >
        {imagePreviewOpen && String(displayImageUrl || "").trim() ? (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl p-3 md:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Product image preview"
          >
            <button
              type="button"
              className="absolute inset-0 rounded-2xl bg-neutral-950/80 backdrop-blur-[1px]"
              aria-label="Close image preview"
              onClick={() => setImagePreviewOpen(false)}
            />
            <div className="relative z-10 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              {!imagePreviewLoadFailed ? (
                <img
                  src={displayImageUrl}
                  alt={title || "Product image"}
                  className="max-h-[88vh] w-full min-h-[12rem] rounded-2xl border border-white/30 object-contain shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
                  onError={() => setImagePreviewLoadFailed(true)}
                />
              ) : (
                <div
                  className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl border border-white/20 bg-neutral-900/50 text-sm text-white/70"
                  role="img"
                  aria-label="Image unavailable"
                >
                  Image unavailable
                </div>
              )}
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/35 bg-black/45 text-lg leading-none text-white transition hover:bg-black/60 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
                aria-label="Close image preview"
                onClick={() => setImagePreviewOpen(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
          </div>
        ) : null}

        {showActionFooter ? (
          <p id="product-inspect-dismiss-hint" className="sr-only">
            To dismiss without choosing an action, use the close control in the header, press Escape, or activate the dimmed area behind this dialog.
          </p>
        ) : null}
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-2.5 border-b border-neutral-200/80 px-3 pb-2 pt-2.5 min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:pb-2.5 min-[390px]:pt-3 min-[430px]:px-5 dark:border-[#1f3c56]/85 md:px-5 md:pb-3 md:pt-4">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="product-inspect-title"
              className="break-words text-pretty text-[15px] font-semibold leading-snug text-neutral-900 min-[390px]:text-base dark:text-slate-100 md:text-lg"
            >
              {title || "Product"}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof onToggleFavorite === "function" ? (
              <button
                type="button"
                className={`btn-icon-only inline-flex items-center justify-center rounded-xl border text-lg leading-none transition md:!h-9 md:!min-h-9 md:!w-9 md:!max-w-9 ${
                  isFavorite
                    ? "border-rose-200/90 bg-rose-50 text-rose-600 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/60 dark:hover:bg-rose-500/20"
                    : "border-neutral-200/90 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => onToggleFavorite()}
              >
                <span aria-hidden>{isFavorite ? "♥" : "♡"}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn-icon-only inline-flex shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 text-lg leading-none text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100 md:!h-9 md:!min-h-9 md:!w-9 md:!max-w-9"
              aria-label={showActionFooter ? "Close product details" : "Close product details"}
              onClick={onClose}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>

        <div className={`drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 min-[390px]:px-4 min-[390px]:py-3 min-[430px]:px-5 md:px-5 md:py-4 ${fullScreen ? "pb-[max(6rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))]" : ""}`}>
          <div className={`flex flex-col gap-3 md:flex-row md:items-start md:gap-4 ${fullScreen ? "lg:gap-6" : ""}`}>
            <div className={`mx-auto flex w-full shrink-0 flex-col ${fullScreen ? "max-w-[13rem] min-[390px]:max-w-[14.5rem] min-[430px]:max-w-[16rem] md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]" : "max-w-[12.5rem] md:mx-0 md:max-w-none"}`}>
              <div className={`relative mx-auto aspect-square w-full shrink-0 ${fullScreen ? "max-w-[13rem] min-[390px]:max-w-[14.5rem] min-[430px]:max-w-[16rem] md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]" : "max-w-[12.5rem] md:mx-0 md:h-36 md:w-36 md:max-w-none md:aspect-auto"}`}>
                {String(displayImageUrl || "").trim() ? (
                  <button
                    type="button"
                    className="absolute inset-0 cursor-zoom-in touch-pan-y"
                    aria-label="View larger product image"
                    onClick={() => setImagePreviewOpen(true)}
                    style={{ touchAction: "pan-y" }}
                  >
                    <ProductListingMedia
                      listing={{ title, imageUrl: displayImageUrl, imageUrls: galleryUrls }}
                      src={displayImageUrl}
                      variant="grid"
                      fillFrame
                      className="absolute inset-0 min-h-0"
                      imageClassName="transition duration-200 hover:scale-[1.02]"
                      sizes="(max-width: 768px) min(90vw, 12.5rem), 9rem"
                      loading="eager"
                    />
                  </button>
                ) : (
                  <ProductListingMedia
                    listing={{ title, imageUrl: "", imageUrls: [] }}
                    variant="grid"
                    fillFrame
                    className="absolute inset-0 min-h-0"
                    loading="eager"
                  />
                )}
              </div>
              {galleryUrls.length > 1 ? (
                <div
                  className={`mt-2 flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5 [-webkit-overflow-scrolling:touch] ${
                    fullScreen
                      ? "max-w-[13rem] min-[390px]:max-w-[14.5rem] min-[430px]:max-w-[16rem] md:max-w-[12rem] lg:max-w-[14rem]"
                      : "max-w-[12.5rem] md:max-w-[9rem]"
                  }`}
                  role="list"
                  aria-label="Product photos"
                >
                  {galleryUrls.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      role="listitem"
                      aria-label={`Photo ${i + 1} of ${galleryUrls.length}`}
                      aria-current={i === galleryThumbIdx ? "true" : undefined}
                      className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        i === galleryThumbIdx
                          ? "border-brand-primary ring-1 ring-brand-primary/30 dark:border-brand-accent dark:ring-brand-accent/25"
                          : "border-transparent opacity-85 hover:opacity-100"
                      }`}
                      onClick={() => setGalleryThumbIdx(i)}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 min-[430px]:space-y-2 md:space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[1.06rem] font-bold tabular-nums text-brand-primary min-[390px]:text-lg dark:text-brand-accent md:text-xl">
                  {formatPesoWhole(priceCents)}
                </p>
                {originalPesos != null && originalPesos > currentPesos ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-500 line-through dark:text-slate-400">
                      ₱{originalPesos}
                    </span>
                    {saleMeta?.percent ? (
                      <span className="rounded-md border border-amber-300/80 bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300">
                        -{saleMeta.percent}%
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {showQuantityLine ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  <span className="font-semibold text-neutral-700 dark:text-slate-300">{quantityLabel}:</span>{" "}
                  <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{quantityNumber}</span>
                </p>
              ) : null}
              {stock != null && !hideStockAvailableAsDuplicate ? (
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

          <div className="mt-3.5 space-y-2.5 min-[390px]:mt-4 min-[390px]:space-y-3 md:mt-5 md:space-y-4">
            <div className="space-y-2.5 border-t border-neutral-200/70 pt-2.5 dark:border-slate-700/70">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                Listing details
              </h3>
              <div className="space-y-1.5 text-[13px] min-[390px]:text-sm">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 font-semibold text-neutral-600 dark:text-slate-400">Category</span>
                  <span className="text-right text-neutral-900 dark:text-slate-100">{categoryTrim || "—"}</span>
                </p>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 font-semibold text-neutral-600 dark:text-slate-400">Pick-up</span>
                  <span className="text-right text-neutral-900 dark:text-slate-100">{offersPickup ? "Yes" : "No"}</span>
                </p>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 font-semibold text-neutral-600 dark:text-slate-400">COD delivery</span>
                  <span className="text-right text-neutral-900 dark:text-slate-100">{offersDelivery ? "Yes" : "No"}</span>
                </p>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="shrink-0 font-semibold text-neutral-600 dark:text-slate-400">Availability</span>
                  <span className="text-right text-neutral-900 dark:text-slate-100">{orderTypeReadable === "In stock" ? "Ready now (in stock)" : "Made/prepared on order"}</span>
                </p>
                {processingTrim ? (
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="shrink-0 font-semibold text-neutral-600 dark:text-slate-400">{processingLabel || "Processing"}</span>
                    <span className="text-right text-neutral-900 dark:text-slate-100">{processingTrim}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2.5 border-t border-neutral-200/70 pt-2.5 dark:border-slate-700/70">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                Product variants
              </h3>
              {hasVariantDetailRows ? (
                <ListingProductMetaExtras
                  orderType={orderType}
                  processingTime={processingTime}
                  optionNameA={optionNameA}
                  optionValuesA={optionValuesA}
                  optionNameB={optionNameB}
                  optionValuesB={optionValuesB}
                  density="card"
                  truncateValueLists={false}
                  variantsOnly
                />
              ) : (
                <p className="text-sm text-neutral-500 dark:text-slate-400">No product variants.</p>
              )}
            </div>

            {descPlain ? (
              <section
                className={`rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2.5 min-[390px]:p-3 dark:border-[#1f3c56] dark:bg-[#11283d]/65 md:p-3.5`}
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                  From the seller
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-neutral-800 dark:text-slate-200 md:mt-2">
                  {descPlain}
                </p>
              </section>
            ) : null}

            {showCommentBlock && commentTrim && !/^n\/a$/i.test(commentTrim) ? (
              <section className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-2.5 min-[390px]:p-3 dark:border-sky-500/35 dark:bg-sky-950/25 md:p-3.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  {commentHeading}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-sky-950 dark:text-sky-50 md:mt-2">
                  {commentTrim}
                </p>
              </section>
            ) : null}

            {hasSellerDetails ? (
              <div className="space-y-1.5 border-t border-neutral-200/70 pt-2.5 text-sm leading-relaxed dark:border-slate-700/70">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                  Seller details
                </h3>
                {sellerUsernameTrim ? (
                  <p className="break-words text-neutral-800 dark:text-slate-200">
                    <span className="font-semibold text-neutral-700 dark:text-slate-300">Username:</span>{" "}
                    {sellerUsernameTrim.startsWith("@") ? sellerUsernameTrim : `@${sellerUsernameTrim}`}
                  </p>
                ) : null}
                {sellerAddressLineTrim ? (
                  <p className="break-words text-neutral-800 dark:text-slate-200">
                    <span className="font-semibold text-neutral-700 dark:text-slate-300">Address:</span>{" "}
                    {sellerAddressLineTrim}
                  </p>
                ) : null}
                {typeof onViewSellerProfile === "function" ? (
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center justify-center rounded-lg border border-neutral-300/90 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                    onClick={() => onViewSellerProfile()}
                  >
                    View profile
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200/80 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 min-[390px]:px-4 min-[390px]:pt-2.5 min-[430px]:px-5 dark:border-[#1f3c56]/85 md:px-5 md:pb-4 md:pt-3">
          {hasSellerHandlers ? (
            <div className="space-y-2">
              <div className="flex w-full flex-col gap-2 md:flex-row md:items-stretch md:gap-2">
                {typeof onSaleSelect === "function" ? (
                  <button
                    type="button"
                    className="min-h-[44px] flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-950/35 md:min-h-10"
                    aria-expanded={salePickerOpen}
                    onClick={() => setSalePickerOpen((v) => !v)}
                  >
                    Sale
                  </button>
                ) : null}
                {typeof onEditListing === "function" ? (
                  <button
                    type="button"
                    className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 md:min-h-10"
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
                hasSellerHandlers ? "mt-2 border-t border-neutral-200/50 pt-2 dark:border-[#1f3c56]/55" : ""
              }
            >
              <div className="flex w-full flex-col gap-2 md:flex-row md:items-stretch md:gap-2">
                {typeof onAddToCart === "function" ? (
                  <button
                    type="button"
                    className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 md:min-h-10"
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart()}
                  >
                    {isOutOfStock ? "Unavailable" : "Add to cart"}
                  </button>
                ) : null}
                {typeof onBuyNow === "function" ? (
                  <button
                    type="button"
                    title={
                      isOutOfStock
                        ? undefined
                        : buyNowDisabled && buyNowDisabledReason
                          ? buyNowDisabledReason
                          : undefined
                    }
                    aria-label={isOutOfStock ? "Out of stock" : "Buy now"}
                    className={`min-h-[44px] flex-1 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-primary/15 transition dark:text-slate-900 dark:shadow-none md:min-h-10 ${
                      isOutOfStock
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-brand-primary/90 dark:hover:bg-brand-accent/90"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
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
            <div className="flex justify-stretch md:justify-end">
              <button type="button" className="btn-primary touch-manipulation w-full md:w-auto md:min-w-[7rem]" onClick={onClose}>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
