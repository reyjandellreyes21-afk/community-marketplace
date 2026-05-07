import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatPesoWhole,
  normalizeListingOptionValues,
  parseSaleMetaFromDescription,
  removeSaleMetaLines,
  SALE_PERCENT_OPTIONS,
} from "../../lib/listingSaleMeta.js";

import { UI_KIT } from "../../lib/appUiKit.js";
import { resolveListingGalleryUrls } from "../../lib/listingImageUrl.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../landing/LandingMarketing.jsx";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
import { ListingProductMetaExtras } from "./ListingProductMetaExtras.jsx";
import { ListingDescriptionMarkdown } from "./ListingDescriptionMarkdown.jsx";
import { OrderStatusMilestoneList } from "./OrderStatusMilestoneList.jsx";
import { SellerBuyerRatingSummary } from "./SellerBuyerRatingSummary.jsx";
import { buyerReviewSectionTitleSummary } from "./buyerReviewSectionClasses.js";

const COURIER_TAG_LABEL = {
  fast: "Fast",
  late: "Late",
  friendly: "Friendly",
};

function initialsFromUsername(username) {
  const u = String(username || "")
    .replace(/^@/, "")
    .trim();
  if (!u) return "?";
  return u.slice(0, 2).toUpperCase();
}

/** Buyer→product, buyer→seller, and buyer→courier ratings when the order row includes reviews. */
function OrderTimelineFeedbackBlocks({ order, viewerRole }) {
  if (!order) return null;
  const productRating = Math.min(5, Math.max(0, Math.round(Number(order.buyerReview?.productRating) || 0)));
  const sellerRating = Math.min(5, Math.max(0, Math.round(Number(order.buyerReview?.sellerRating) || 0)));
  const hasProductReview = productRating >= 1;
  const hasSellerReview = sellerRating >= 1;
  const courierRating = Math.min(5, Math.max(0, Math.round(Number(order.buyerCourierReview?.rating) || 0)));
  const hasCourierReview = courierRating >= 1;
  const delivery = String(order.fulfillmentType || "") === "delivery";
  const viewerIsBuyer = viewerRole === "buyer";
  const showProductBlock = viewerIsBuyer && hasProductReview;
  const showSellerBlock = hasSellerReview;
  if (!showProductBlock && !showSellerBlock && !(delivery && hasCourierReview)) return null;

  const cardClass =
    "rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-900/50";
  const courierTags = Array.isArray(order.buyerCourierReview?.tags)
    ? order.buyerCourierReview.tags.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean)
    : [];

  return (
    <div className="mt-2 space-y-2">
      {showProductBlock ? (
        <div className={cardClass}>
          <p className={buyerReviewSectionTitleSummary}>Your product rating</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400"
              aria-label={`${productRating} out of 5 stars`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < productRating ? "text-amber-500 dark:text-amber-400" : "text-neutral-300 dark:text-slate-600"
                  }
                >
                  ★
                </span>
              ))}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-neutral-700 dark:text-slate-300">
              {productRating} / 5
            </span>
          </div>
          {order.buyerReview?.productReviewText ? (
            <p className="mt-2 text-pretty text-[11px] leading-relaxed text-neutral-700 dark:text-slate-300">
              {order.buyerReview.productReviewText}
            </p>
          ) : (
            <p className="mt-2 text-[11px] italic text-neutral-500 dark:text-slate-500">No product comment.</p>
          )}
        </div>
      ) : null}
      {showSellerBlock ? (
        <div className={cardClass}>
          <p className={buyerReviewSectionTitleSummary}>
            {viewerIsBuyer ? "Your seller rating" : "Buyer rated you as seller"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400"
              aria-label={`${sellerRating} out of 5 stars`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < sellerRating ? "text-amber-500 dark:text-amber-400" : "text-neutral-300 dark:text-slate-600"
                  }
                >
                  ★
                </span>
              ))}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-neutral-700 dark:text-slate-300">
              {sellerRating} / 5
            </span>
          </div>
          {order.buyerReview?.sellerReviewText ? (
            <p className="mt-2 text-pretty text-[11px] leading-relaxed text-neutral-700 dark:text-slate-300">
              {order.buyerReview.sellerReviewText}
            </p>
          ) : (
            <p className="mt-2 text-[11px] italic text-neutral-500 dark:text-slate-500">No seller comment.</p>
          )}
        </div>
      ) : null}
      {delivery && hasCourierReview ? (
        <div className={cardClass}>
          <p className={buyerReviewSectionTitleSummary}>
            {viewerIsBuyer ? "Your courier rating" : "Courier feedback"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400"
              aria-label={`${courierRating} out of 5 stars`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < courierRating ? "text-amber-500 dark:text-amber-400" : "text-neutral-300 dark:text-slate-600"
                  }
                >
                  ★
                </span>
              ))}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-neutral-700 dark:text-slate-300">
              {courierRating} / 5
            </span>
          </div>
          {courierTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {courierTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-neutral-200/90 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                >
                  {COURIER_TAG_LABEL[t] || t}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] italic text-neutral-500 dark:text-slate-500">No tags selected.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Rubber-band: higher = closer to 1:1 drag at first/last slide (was 0.33 — felt like it wouldn’t pull far). */
const GALLERY_DRAG_EDGE_RESISTANCE = 0.78;

const PRIMARY_QUICK_SALE_PERCENTS = [5, 10, 15, 25, 50];
const OTHER_QUICK_SALE_PERCENTS = SALE_PERCENT_OPTIONS.filter(
  (percent) => !PRIMARY_QUICK_SALE_PERCENTS.includes(Number(percent)),
);

/** Once horizontal intent wins, lock so vertical scroll / browser gestures don’t steal the drag. */
const GALLERY_HORIZONTAL_LOCK_PX = 10;

/**
 * Read-only product detail: gallery, pricing, listing fields aligned with upload form (category, fulfillment,
 * order type, processing, variants), description, optional note.
 * Optional footer: buyer (Add to cart / Place order) or seller (Discount / Edit). Dismiss: header ×, backdrop, or Esc.
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
  sellerAvatarUrl = "",
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
  /** Total sold units for this listing. */
  listingSoldQty = null,
  showBuyerCommerceActions = false,
  showSellerCommerceActions = false,
  onAddToCart,
  onBuyNow,
  onEditListing,
  onSaleSelect,
  onViewSellerProfile,
  onContactSeller,
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
  /** Buyer ratings aggregated from completed-order reviews (`order_reviews`) for this listing. */
  listingAvgRating = null,
  listingReviewCount = 0,
  isFavorite = false,
  onToggleFavorite,
  /** When set (e.g. opened from an order card), show milestone timeline for this order only. */
  orderTimelineOrder = null,
  /** Optional explicit IDs (e.g. merged buyer rows); defaults to `orderTimelineOrder.id`. */
  orderTimelineOrderIds = null,
  orderTimelineContextTab = null,
  /** `"buyer"` | `"seller"` — who is viewing (cancellation wording). */
  orderTimelineViewerRole = null,
}) {
  const [salePickerOpen, setSalePickerOpen] = useState(false);
  const [showOtherSaleOptions, setShowOtherSaleOptions] = useState(false);
  const [customDiscountDraft, setCustomDiscountDraft] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewLoadFailed, setImagePreviewLoadFailed] = useState(false);
  const [galleryThumbIdx, setGalleryThumbIdx] = useState(0);
  const heroContainerRef = useRef(null);
  const suppressHeroClickRef = useRef(false);
  const heroPointerStartRef = useRef({ x: 0, y: 0 });
  const heroGestureMovedRef = useRef(false);
  const heroDragActiveRef = useRef(false);

  const lightboxStageRef = useRef(null);
  const lightboxPointerStartRef = useRef({ x: 0, y: 0 });
  const lightboxGestureMovedRef = useRef(false);
  const lightboxDragActiveRef = useRef(false);

  const galleryThumbIdxRef = useRef(0);
  const heroHorizontalLockRef = useRef(false);
  const lightboxHorizontalLockRef = useRef(false);
  const [heroDragPx, setHeroDragPx] = useState(0);
  const [heroStripDragging, setHeroStripDragging] = useState(false);
  const [lightboxDragPx, setLightboxDragPx] = useState(0);
  const [lightboxStripDragging, setLightboxStripDragging] = useState(false);
  const [sellerAvatarBroken, setSellerAvatarBroken] = useState(false);

  const imageUrlsSignature = useMemo(
    () =>
      Array.isArray(imageUrls)
        ? imageUrls.map((u) => String(u || "").trim()).join("\u0001")
        : "",
    [imageUrls],
  );
  const galleryUrls = useMemo(
    () => resolveListingGalleryUrls({ imageUrl, imageUrls }),
    [imageUrl, imageUrls, imageUrlsSignature],
  );
  const galleryUrlsKey = useMemo(() => galleryUrls.join("|"), [galleryUrls]);
  const displayImageUrl = galleryUrls[galleryThumbIdx] || galleryUrls[0] || "";
  const saleMeta = parseSaleMetaFromDescription(description);
  const currentPesos = (Number(priceCents) || 0) / 100;
  const originalPesos = Number.isFinite(Number(saleMeta?.originalPesos)) ? Number(saleMeta.originalPesos) : null;

  const orderInspectDisplayIds = useMemo(() => {
    if (Array.isArray(orderTimelineOrderIds) && orderTimelineOrderIds.length > 0) {
      return orderTimelineOrderIds.map((x) => String(x || "").trim()).filter(Boolean);
    }
    const one = String(orderTimelineOrder?.id || "").trim();
    return one ? [one] : [];
  }, [orderTimelineOrderIds, orderTimelineOrder]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (imagePreviewOpen) {
        e.preventDefault();
        setImagePreviewOpen(false);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, imagePreviewOpen]);

  useEffect(() => {
    if (!open) {
      setSalePickerOpen(false);
      setShowOtherSaleOptions(false);
      setCustomDiscountDraft("");
    }
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
  }, [open, galleryUrlsKey]);

  useEffect(() => {
    setSellerAvatarBroken(false);
  }, [open, sellerAvatarUrl]);

  useEffect(() => {
    galleryThumbIdxRef.current = galleryThumbIdx;
  }, [galleryThumbIdx]);

  useEffect(() => {
    setHeroDragPx(0);
  }, [galleryThumbIdx]);

  useEffect(() => {
    setLightboxDragPx(0);
  }, [galleryThumbIdx, imagePreviewOpen]);

  const goGalleryPrev = () => {
    setGalleryThumbIdx((i) => Math.max(0, i - 1));
  };
  const goGalleryNext = () => {
    setGalleryThumbIdx((i) => Math.min(galleryUrls.length - 1, i + 1));
  };

  const applyEdgeResistance = (dx, idx, len) => {
    let d = dx;
    if (idx === 0 && d > 0) d *= GALLERY_DRAG_EDGE_RESISTANCE;
    if (idx === len - 1 && d < 0) d *= GALLERY_DRAG_EDGE_RESISTANCE;
    return d;
  };

  /** ~14% of width: easier to complete a slide than the old 20% capped at 56px. */
  const commitThresholdFromEl = (el) => {
    const w = el?.clientWidth ?? 0;
    if (w <= 0) return 40;
    return Math.min(80, Math.max(24, w * 0.14));
  };

  const onHeroStripPointerDown = (e) => {
    if (galleryUrls.length <= 1) return;
    if (e.button != null && e.button !== 0) return;
    heroDragActiveRef.current = true;
    heroHorizontalLockRef.current = false;
    setHeroStripDragging(true);
    heroGestureMovedRef.current = false;
    heroPointerStartRef.current = { x: e.clientX, y: e.clientY };
    setHeroDragPx(0);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHeroStripPointerMove = (e) => {
    if (!heroDragActiveRef.current || galleryUrls.length <= 1) return;
    const dx = e.clientX - heroPointerStartRef.current.x;
    const dy = e.clientY - heroPointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 6) heroGestureMovedRef.current = true;
    if (
      !heroHorizontalLockRef.current &&
      Math.abs(dx) >= GALLERY_HORIZONTAL_LOCK_PX &&
      Math.abs(dx) > Math.abs(dy) * 1.05
    ) {
      heroHorizontalLockRef.current = true;
    }
    const idx = galleryThumbIdxRef.current;
    const d = applyEdgeResistance(dx, idx, galleryUrls.length);
    setHeroDragPx(d);
    if (e.cancelable && (heroHorizontalLockRef.current || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)))) {
      e.preventDefault();
    }
  };

  const onHeroStripPointerUp = (e) => {
    if (!heroDragActiveRef.current) return;
    heroDragActiveRef.current = false;
    heroHorizontalLockRef.current = false;
    const dx = e.clientX - heroPointerStartRef.current.x;
    const idx = galleryThumbIdxRef.current;
    const n = galleryUrls.length;
    const t = commitThresholdFromEl(heroContainerRef.current);
    let navigated = false;
    if (dx < -t && idx < n - 1) {
      goGalleryNext();
      navigated = true;
    } else if (dx > t && idx > 0) {
      goGalleryPrev();
      navigated = true;
    }
    setHeroStripDragging(false);
    setHeroDragPx(0);
    if (navigated) suppressHeroClickRef.current = true;
    else if (heroGestureMovedRef.current && Math.abs(dx) > 10) suppressHeroClickRef.current = true;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHeroStripPointerCancel = (e) => {
    if (!heroDragActiveRef.current) return;
    heroDragActiveRef.current = false;
    heroHorizontalLockRef.current = false;
    setHeroStripDragging(false);
    setHeroDragPx(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onLightboxStripPointerDown = (e) => {
    if (galleryUrls.length <= 1) return;
    if (e.button != null && e.button !== 0) return;
    lightboxDragActiveRef.current = true;
    lightboxHorizontalLockRef.current = false;
    setLightboxStripDragging(true);
    lightboxGestureMovedRef.current = false;
    lightboxPointerStartRef.current = { x: e.clientX, y: e.clientY };
    setLightboxDragPx(0);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onLightboxStripPointerMove = (e) => {
    if (!lightboxDragActiveRef.current || galleryUrls.length <= 1) return;
    const dx = e.clientX - lightboxPointerStartRef.current.x;
    const dy = e.clientY - lightboxPointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 6) lightboxGestureMovedRef.current = true;
    if (
      !lightboxHorizontalLockRef.current &&
      Math.abs(dx) >= GALLERY_HORIZONTAL_LOCK_PX &&
      Math.abs(dx) > Math.abs(dy) * 1.05
    ) {
      lightboxHorizontalLockRef.current = true;
    }
    const idx = galleryThumbIdxRef.current;
    const d = applyEdgeResistance(dx, idx, galleryUrls.length);
    setLightboxDragPx(d);
    if (e.cancelable && (lightboxHorizontalLockRef.current || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)))) {
      e.preventDefault();
    }
  };

  const onLightboxStripPointerUp = (e) => {
    if (!lightboxDragActiveRef.current) return;
    lightboxDragActiveRef.current = false;
    lightboxHorizontalLockRef.current = false;
    const dx = e.clientX - lightboxPointerStartRef.current.x;
    const idx = galleryThumbIdxRef.current;
    const n = galleryUrls.length;
    const t = commitThresholdFromEl(lightboxStageRef.current);
    if (dx < -t && idx < n - 1) goGalleryNext();
    else if (dx > t && idx > 0) goGalleryPrev();
    setLightboxStripDragging(false);
    setLightboxDragPx(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onLightboxStripPointerCancel = (e) => {
    if (!lightboxDragActiveRef.current) return;
    lightboxDragActiveRef.current = false;
    lightboxHorizontalLockRef.current = false;
    setLightboxStripDragging(false);
    setLightboxDragPx(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHeroImageActivate = () => {
    if (suppressHeroClickRef.current) {
      suppressHeroClickRef.current = false;
      return;
    }
    setImagePreviewOpen(true);
  };

  if (!open) return null;

  const galleryMulti = galleryUrls.length > 1;
  const canGalleryPrev = galleryThumbIdx > 0;
  const canGalleryNext = galleryThumbIdx < galleryUrls.length - 1;

  const descPlain = removeSaleMetaLines(description);
  const sellerUsernameTrim = String(sellerUsername || "").trim();
  const sellerAddressLineTrim = String(sellerAddressLine || "").trim();
  const sellerAvatarTrim = String(sellerAvatarUrl || "").trim();
  const hasSellerDetails =
    sellerUsernameTrim.length > 0 ||
    sellerAddressLineTrim.length > 0 ||
    sellerAvatarTrim.length > 0 ||
    typeof onViewSellerProfile === "function" ||
    typeof onContactSeller === "function";
  const sellerInitials = initialsFromUsername(sellerUsernameTrim);
  const commentTrim = String(comment || "").trim();
  const showCommentBlock = commentSectionRequired || commentTrim.length > 0;
  const stock =
    listingStockQty != null && Number.isFinite(Number(listingStockQty)) ? Math.max(0, Number(listingStockQty)) : null;
  const soldQty =
    listingSoldQty != null && Number.isFinite(Number(listingSoldQty)) ? Math.max(0, Number(listingSoldQty)) : null;
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
  const customDiscountValue = Number(customDiscountDraft);
  const customDiscountValid =
    Number.isFinite(customDiscountValue) &&
    Number.isInteger(customDiscountValue) &&
    customDiscountValue >= 1 &&
    customDiscountValue <= 99;
  const showActionFooter = hasBuyerHandlers || hasSellerHandlers;

  const fulfillmentModesArr = Array.isArray(fulfillmentModes) ? fulfillmentModes : [];
  const offersPickup = fulfillmentModesArr.includes("pickup");
  const offersDelivery = fulfillmentModesArr.includes("delivery");
  const fulfillmentSummary = offersPickup && offersDelivery ? "Pick-up, COD delivery" : offersDelivery ? "COD delivery" : "Pick-up";
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
  const orderTypeDisplay = orderTypeReadable || "In stock";
  const availabilitySummary = orderTypeReadable === "In stock" ? "Ready now" : "Made on order";
  const nameATrim = String(optionNameA || "").trim();
  const nameBTrim = String(optionNameB || "").trim();
  const variantValsA = normalizeListingOptionValues(optionValuesA);
  const variantValsB = normalizeListingOptionValues(optionValuesB);
  const variantChoicesAText = variantValsA.length > 0 ? variantValsA.join(", ") : "";
  const variantChoicesBText = variantValsB.length > 0 ? variantValsB.join(", ") : "";
  const hasAnyVariantData =
    Boolean(nameATrim) || Boolean(nameBTrim) || Boolean(variantChoicesAText) || Boolean(variantChoicesBText);

  return (
    <div
      className={
        fullScreen
          ? "flex w-full min-h-0 flex-1 flex-col max-md:h-full max-md:w-[calc(100%+1.75rem)] max-md:self-stretch max-md:-mx-3.5 md:mx-0 md:w-full"
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
            ? "mx-auto w-full max-w-screen-lg rounded-none border-0 bg-white shadow-none dark:bg-slate-950 max-md:max-h-[100dvh] max-md:min-h-0 max-md:flex-1 max-md:overflow-hidden md:min-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]"
            : "max-h-[min(88dvh,42rem)] max-w-lg rounded-t-2xl border border-neutral-200/90 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] dark:border-[#1f3c56] dark:bg-[#0f2234] md:max-h-[min(90dvh,44rem)] md:rounded-2xl md:shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
        } ${UI_KIT.surfaceFloating}`}
        onClick={(e) => e.stopPropagation()}
      >
        {imagePreviewOpen && String(displayImageUrl || "").trim() ? (
          <div
            className="fixed inset-0 z-[220] flex h-[100dvh] w-screen items-center justify-center pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
            role="dialog"
            aria-modal="true"
            aria-label="Product image preview"
          >
            <button
              type="button"
              className="absolute inset-0 bg-neutral-950/95 backdrop-blur-[1px]"
              aria-label="Close image preview"
              onClick={() => setImagePreviewOpen(false)}
            />
            <div
              ref={lightboxStageRef}
              className="relative z-10 h-full w-full max-w-none touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              {!imagePreviewLoadFailed ? (
                galleryMulti ? (
                  <div className="relative h-full min-h-0 w-full overflow-hidden rounded-none border-0 shadow-none">
                    <div
                      className="flex h-full min-h-0 touch-none select-none will-change-transform"
                      style={{
                        width: `${galleryUrls.length * 100}%`,
                        transform: `translate3d(calc(-${(galleryThumbIdx * 100) / galleryUrls.length}% + ${lightboxDragPx}px), 0, 0)`,
                        transition: lightboxStripDragging
                          ? "none"
                          : "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                      }}
                    >
                      {galleryUrls.map((url, i) => (
                        <div
                          key={`lb-${i}-${String(url).slice(-24)}`}
                          className="flex h-full min-h-0 shrink-0 items-center justify-center bg-neutral-950/20"
                          style={{ width: `${100 / galleryUrls.length}%` }}
                        >
                          <img
                            src={url}
                            alt={i === 0 ? title || "Product image" : ""}
                            className="h-full w-full object-contain"
                            onError={() => setImagePreviewLoadFailed(true)}
                            draggable={false}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="absolute inset-0 z-[4] cursor-grab bg-transparent active:cursor-grabbing"
                      aria-hidden
                      tabIndex={-1}
                      onPointerDown={onLightboxStripPointerDown}
                      onPointerMove={onLightboxStripPointerMove}
                      onPointerUp={onLightboxStripPointerUp}
                      onPointerCancel={onLightboxStripPointerCancel}
                      style={{ touchAction: "none" }}
                    />
                  </div>
                ) : (
                  <img
                    src={displayImageUrl}
                    alt={title || "Product image"}
                    className="h-full w-full min-h-0 rounded-none border-0 object-contain shadow-none"
                    onError={() => setImagePreviewLoadFailed(true)}
                    draggable={false}
                  />
                )
              ) : (
                <div
                  className="flex min-h-[40vh] w-full items-center justify-center rounded-2xl border border-white/20 bg-neutral-900/50 text-sm text-white/70"
                  role="img"
                  aria-label="Image unavailable"
                >
                  Image unavailable
                </div>
              )}
              {galleryMulti ? (
                <>
                  <button
                    type="button"
                    className={`absolute left-2.5 top-1/2 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/55 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/25 backdrop-blur-[2px] transition hover:bg-black/70 active:scale-[0.96] motion-reduce:active:scale-100 md:left-3 ${
                      !canGalleryPrev ? "pointer-events-none opacity-30" : ""
                    }`}
                    aria-label="Previous product photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      goGalleryPrev();
                    }}
                  >
                    <ChevronLeftIcon className="h-6 w-6 shrink-0 opacity-95" />
                  </button>
                  <button
                    type="button"
                    className={`absolute right-2.5 top-1/2 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/55 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/25 backdrop-blur-[2px] transition hover:bg-black/70 active:scale-[0.96] motion-reduce:active:scale-100 md:right-12 ${
                      !canGalleryNext ? "pointer-events-none opacity-30" : ""
                    }`}
                    aria-label="Next product photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      goGalleryNext();
                    }}
                  >
                    <ChevronRightIcon className="h-6 w-6 shrink-0 opacity-95" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="absolute left-4 top-5 z-10 inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center text-white transition hover:text-white/85 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
                aria-label="Back"
                onClick={() => setImagePreviewOpen(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                  aria-hidden
                >
                  <path d="M19 12H5" />
                  <path d="M11 6l-6 6 6 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}

        {showActionFooter ? (
          <p id="product-inspect-dismiss-hint" className="sr-only">
            To dismiss without choosing an action, use the close control in the header, press Escape, or activate the dimmed area behind this dialog.
          </p>
        ) : null}
        <div className="flex min-w-0 shrink-0 items-start justify-between gap-2.5 border-b border-neutral-200/80 px-3 pb-2 pt-2.5 min-[360px]:gap-3 min-[360px]:px-5 min-[360px]:pb-2.5 min-[360px]:pt-3 dark:border-[#1f3c56]/85 md:px-5 md:pb-3 md:pt-4">
          <button
            type="button"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-neutral-700 transition hover:text-neutral-900 dark:text-slate-200 dark:hover:text-slate-50 md:h-9 md:min-h-0 md:min-w-0 md:w-9"
            aria-label="Back"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden
            >
              <path d="M19 12H5" />
              <path d="M11 6l-6 6 6 6" />
            </svg>
          </button>
          {typeof onToggleFavorite === "function" ? (
            <button
              type="button"
              className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center transition [-webkit-tap-highlight-color:transparent] md:h-9 md:min-h-0 md:min-w-0 md:w-9 ${
                isFavorite
                  ? "text-rose-600 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => onToggleFavorite()}
            >
              <span aria-hidden className={`text-[24px] leading-none ${isFavorite ? "drop-shadow-[0_1px_2px_rgba(190,24,93,0.28)]" : ""}`}>
                {isFavorite ? "♥" : "♡"}
              </span>
            </button>
          ) : (
            <span className="h-11 w-11 md:h-9 md:w-9" aria-hidden />
          )}
        </div>

        <div
          className={`drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 min-[360px]:px-5 min-[360px]:py-3 md:px-5 md:py-4 ${
            fullScreen
              ? "max-md:pt-0 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:pb-5"
              : ""
          }`}
        >
          <div className={`flex flex-col gap-3 md:flex-row md:items-start md:gap-4 ${fullScreen ? "lg:gap-6" : ""}`}>
            <div
              className={`mx-auto flex w-full shrink-0 flex-col ${
                fullScreen
                  ? "max-md:-mx-3 max-md:w-[calc(100%+1.5rem)] max-md:max-w-none min-[360px]:max-md:-mx-5 min-[360px]:max-md:w-[calc(100%+2.5rem)] md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]"
                  : "max-w-[12.5rem] md:mx-0 md:max-w-none"
              }`}
            >
              <div
                className={`relative mx-auto aspect-square w-full shrink-0 ${
                  fullScreen
                    ? "max-md:max-w-none md:mx-0 md:max-w-[12rem] lg:max-w-[14rem]"
                    : "max-w-[12.5rem] md:mx-0 md:h-36 md:w-36 md:max-w-none md:aspect-auto"
                }`}
              >
                {String(displayImageUrl || "").trim() ? (
                  <>
                    {galleryMulti && !imagePreviewOpen ? (
                      <div
                        ref={heroContainerRef}
                        className="relative aspect-square w-full overflow-hidden rounded-none bg-neutral-100 ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10"
                      >
                        <div
                          className="flex h-full touch-none select-none will-change-transform"
                          style={{
                            width: `${galleryUrls.length * 100}%`,
                            transform: `translate3d(calc(-${(galleryThumbIdx * 100) / galleryUrls.length}% + ${heroDragPx}px), 0, 0)`,
                            transition: heroStripDragging
                              ? "none"
                              : "transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                          }}
                        >
                          {galleryUrls.map((url, i) => (
                            <div
                              key={`hero-g-${i}-${String(url).slice(-28)}`}
                              className="h-full shrink-0"
                              style={{ width: `${100 / galleryUrls.length}%` }}
                            >
                              <img
                                src={url}
                                alt={i === 0 ? title || "Product" : ""}
                                className="h-full w-full object-cover select-none"
                                draggable={false}
                                loading={i === 0 ? "eager" : "lazy"}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="absolute inset-0 z-[4] cursor-grab bg-transparent active:cursor-grabbing"
                          aria-label="View larger product image. Drag left or right for more photos."
                          onPointerDown={onHeroStripPointerDown}
                          onPointerMove={onHeroStripPointerMove}
                          onPointerUp={onHeroStripPointerUp}
                          onPointerCancel={onHeroStripPointerCancel}
                          onClick={onHeroImageActivate}
                          style={{ touchAction: "none" }}
                        />
                        <p
                          className="pointer-events-none absolute bottom-2 right-2 z-[6] rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-xs font-semibold tabular-nums text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-[2px] min-[360px]:bottom-2.5 min-[360px]:right-2.5 min-[360px]:text-[13px]"
                          aria-live="polite"
                        >
                          {galleryThumbIdx + 1}/{galleryUrls.length}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="relative z-0 aspect-square w-full cursor-zoom-in overflow-hidden rounded-none touch-pan-y ring-1 ring-black/5 dark:ring-white/10"
                        aria-label="View larger product image"
                        onClick={onHeroImageActivate}
                        style={{ touchAction: "pan-x pan-y" }}
                      >
                        <ProductListingMedia
                          listing={{ title, imageUrl: displayImageUrl, imageUrls: galleryUrls }}
                          src={displayImageUrl}
                          variant="grid"
                          fillFrame
                          className="pointer-events-none absolute inset-0 min-h-0"
                          imageClassName="transition duration-200 hover:scale-[1.02]"
                          sizes={
                            fullScreen
                              ? "(max-width: 768px) min(100vw, 64rem), 12rem"
                              : "(max-width: 768px) min(90vw, 12.5rem), 9rem"
                          }
                          loading="eager"
                        />
                      </button>
                    )}
                    {galleryMulti && !imagePreviewOpen ? (
                      <>
                        <button
                          type="button"
                          className={`absolute left-2.5 top-1/2 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/55 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/25 backdrop-blur-[2px] transition hover:bg-black/70 active:scale-[0.96] motion-reduce:active:scale-100 ${
                            !canGalleryPrev ? "pointer-events-none opacity-35" : ""
                          }`}
                          aria-label="Previous product photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            goGalleryPrev();
                          }}
                        >
                          <ChevronLeftIcon className="h-6 w-6 shrink-0 opacity-95" />
                        </button>
                        <button
                          type="button"
                          className={`absolute right-2.5 top-1/2 z-20 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/55 text-white shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/25 backdrop-blur-[2px] transition hover:bg-black/70 active:scale-[0.96] motion-reduce:active:scale-100 ${
                            !canGalleryNext ? "pointer-events-none opacity-35" : ""
                          }`}
                          aria-label="Next product photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            goGalleryNext();
                          }}
                        >
                          <ChevronRightIcon className="h-6 w-6 shrink-0 opacity-95" />
                        </button>
                      </>
                    ) : null}
                  </>
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
                      ? "w-full max-md:justify-center md:max-w-[12rem] lg:max-w-[14rem]"
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
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-none border-2 transition ${
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
            <div className="min-w-0 flex-1 space-y-1.5 min-[360px]:space-y-2 md:space-y-2">
              <div className="min-w-0">
                <h2
                  id="product-inspect-title"
                  className="break-words text-pretty text-[1.12rem] font-bold leading-tight tracking-tight text-neutral-900 min-[360px]:text-xl dark:text-slate-100 md:text-2xl"
                >
                  {title || "Product"}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-500 dark:text-slate-400">{subtitle}</p>
                ) : null}
                <SellerBuyerRatingSummary
                  avg={listingAvgRating}
                  count={listingReviewCount}
                  className="mt-1 text-sm text-amber-900/95 dark:text-amber-100/95"
                />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[1.06rem] font-bold tabular-nums text-brand-primary min-[360px]:text-lg dark:text-brand-accent md:text-xl">
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
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {categoryTrim ? (
                  <span className="rounded-full border border-amber-300/80 bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300">
                    {categoryTrim}
                  </span>
                ) : null}
                <span className="rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary dark:border-brand-accent/35 dark:bg-brand-accent/15 dark:text-slate-100">
                  {orderTypeDisplay}
                </span>
                <span className="rounded-full border border-neutral-300/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {processingTrim ? `${processingLabel || "Processing"}: ${processingTrim}` : availabilitySummary}
                </span>
                <span className="rounded-full border border-neutral-300/80 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {fulfillmentSummary}
                </span>
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
              {soldQty != null ? (
                <p className="text-xs text-neutral-600 dark:text-slate-400">
                  <span className="font-semibold text-neutral-700 dark:text-slate-300">Sold:</span>{" "}
                  <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{soldQty}</span>
                </p>
              ) : null}
              {orderTimelineOrder && String(orderTimelineContextTab || "").trim() ? (
                <>
                  {orderInspectDisplayIds.length > 0 ? (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-900/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                        {orderInspectDisplayIds.length > 1 ? "Order IDs" : "Order ID"}
                      </p>
                      <div className="space-y-0.5">
                        {orderInspectDisplayIds.map((id) => (
                          <p
                            key={id}
                            className="break-all font-mono text-[11px] leading-snug text-neutral-700 dark:text-slate-300"
                          >
                            {id}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <OrderStatusMilestoneList
                    order={orderTimelineOrder}
                    contextTab={String(orderTimelineContextTab).trim()}
                    viewerRole={orderTimelineViewerRole}
                    className="mt-2"
                  />
                  <OrderTimelineFeedbackBlocks order={orderTimelineOrder} viewerRole={orderTimelineViewerRole} />
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-3.5 space-y-2.5 min-[360px]:mt-4 min-[360px]:space-y-3 md:mt-5 md:space-y-4">
            <div className="space-y-2.5 border-t border-neutral-200/70 pt-2.5 dark:border-slate-700/70">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                Product variants
              </h3>
              {hasAnyVariantData ? (
                <div className="space-y-2">
                  {nameATrim || variantValsA.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-800 dark:text-slate-100">{nameATrim || "Variant"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variantValsA.length > 0 ? (
                          variantValsA.map((choice) => (
                            <span
                              key={`variant-a-${choice}`}
                              className="rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary dark:border-brand-accent/35 dark:bg-brand-accent/15 dark:text-slate-100"
                            >
                              {choice}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-500 dark:text-slate-400">No choices set.</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {(nameATrim || variantValsA.length > 0) && (nameBTrim || variantValsB.length > 0) ? (
                    <div className="h-px w-full bg-neutral-200/80 dark:bg-slate-700/80" aria-hidden />
                  ) : null}
                  {nameBTrim || variantValsB.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-800 dark:text-slate-100">{nameBTrim || "Variant"}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variantValsB.length > 0 ? (
                          variantValsB.map((choice) => (
                            <span
                              key={`variant-b-${choice}`}
                              className="rounded-full border border-brand-primary/35 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary dark:border-brand-accent/35 dark:bg-brand-accent/15 dark:text-slate-100"
                            >
                              {choice}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-500 dark:text-slate-400">No choices set.</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-slate-400">No product variants.</p>
              )}
            </div>

            {descPlain ? (
              <section className="min-w-0 space-y-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                  Description
                </h3>
                <ListingDescriptionMarkdown text={description} />
              </section>
            ) : null}

            {showCommentBlock && commentTrim && !/^n\/a$/i.test(commentTrim) ? (
              <section className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-2.5 min-[360px]:p-3 dark:border-sky-500/35 dark:bg-sky-950/25 md:p-3.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  {commentHeading}
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-pretty text-sm leading-relaxed text-sky-950 dark:text-sky-50 md:mt-2">
                  {commentTrim}
                </p>
              </section>
            ) : null}

            {hasSellerDetails ? (
              <div className="space-y-2 border-t border-neutral-200/70 pt-2.5 text-sm leading-relaxed dark:border-slate-700/70">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                  Seller details
                </h3>
                <div className="flex gap-3">
                  <div
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-neutral-200/90 bg-neutral-100 dark:border-slate-600 dark:bg-slate-800"
                    aria-label={sellerUsernameTrim ? `Seller avatar for ${sellerUsernameTrim}` : "Seller avatar"}
                  >
                    {sellerAvatarTrim && !sellerAvatarBroken ? (
                      <img
                        src={sellerAvatarTrim}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setSellerAvatarBroken(true)}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-600 dark:text-slate-300">
                        {sellerInitials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
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
                  </div>
                </div>
                {typeof onContactSeller === "function" || typeof onViewSellerProfile === "function" ? (
                  <div className="flex flex-wrap gap-2">
                    {typeof onContactSeller === "function" ? (
                      <button
                        type="button"
                        className="inline-flex min-h-8 min-w-[7.5rem] flex-1 items-center justify-center rounded-lg border border-neutral-300/90 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                        onClick={() => onContactSeller()}
                      >
                        Contact seller
                      </button>
                    ) : null}
                    {typeof onViewSellerProfile === "function" ? (
                      <button
                        type="button"
                        className="inline-flex min-h-8 min-w-[7.5rem] flex-1 items-center justify-center rounded-lg border border-neutral-300/90 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 sm:flex-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                        onClick={() => onViewSellerProfile()}
                      >
                        View profile
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-neutral-200/80 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/85 min-[360px]:px-5 min-[360px]:pt-2.5 dark:border-[#1f3c56]/85 dark:bg-[#0f2234]/95 dark:shadow-none md:static md:bg-transparent md:px-5 md:pb-4 md:pt-3 md:shadow-none md:backdrop-blur-0">
          {hasSellerHandlers ? (
            <div className="space-y-2">
              {salePickerOpen && typeof onSaleSelect === "function" ? (
                <div className="min-w-0 w-full rounded-xl border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Apply discount
                  </p>
                  <div className="flex w-full min-w-0 flex-wrap gap-1.5">
                    {PRIMARY_QUICK_SALE_PERCENTS.map((percent) => (
                      <button
                        key={percent}
                        type="button"
                        className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        onClick={() => {
                          onSaleSelect(percent);
                          setCustomDiscountDraft("");
                          setSalePickerOpen(false);
                        }}
                      >
                        {percent}%
                      </button>
                    ))}
                    {OTHER_QUICK_SALE_PERCENTS.length > 0 ? (
                      <button
                        type="button"
                        className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                        aria-expanded={showOtherSaleOptions}
                        onClick={() => setShowOtherSaleOptions((prev) => !prev)}
                      >
                        {showOtherSaleOptions ? "Hide options" : "More options"}
                      </button>
                    ) : null}
                  </div>
                  {showOtherSaleOptions && OTHER_QUICK_SALE_PERCENTS.length > 0 ? (
                    <div className="mt-1.5 flex w-full min-w-0 flex-wrap gap-1.5">
                      {OTHER_QUICK_SALE_PERCENTS.map((percent) => (
                        <button
                          key={`other-${percent}`}
                          type="button"
                          className="rounded-md border border-amber-300/90 bg-white px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                          onClick={() => {
                            onSaleSelect(percent);
                            setCustomDiscountDraft("");
                            setShowOtherSaleOptions(false);
                            setSalePickerOpen(false);
                          }}
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      step={1}
                      inputMode="numeric"
                      placeholder="Custom %"
                      className="h-8 w-24 rounded-md border border-amber-300/90 bg-white px-2 text-xs font-semibold text-amber-900 outline-none transition placeholder:text-amber-500/80 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-100 dark:placeholder:text-amber-300/70"
                      value={customDiscountDraft}
                      onChange={(e) => {
                        const digits = String(e.target.value || "").replace(/[^\d]/g, "");
                        if (!digits) {
                          setCustomDiscountDraft("");
                          return;
                        }
                        setCustomDiscountDraft(String(Math.min(99, Number(digits))));
                      }}
                    />
                    <button
                      type="button"
                      className="h-8 rounded-md border border-amber-300/90 bg-white px-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
                      disabled={!customDiscountValid}
                      onClick={() => {
                        if (!customDiscountValid) return;
                        onSaleSelect(customDiscountValue);
                        setCustomDiscountDraft("");
                        setShowOtherSaleOptions(false);
                        setSalePickerOpen(false);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex w-full flex-row items-stretch gap-2">
                {typeof onSaleSelect === "function" ? (
                  <button
                    type="button"
                    className="min-h-[56px] flex-1 rounded-lg border border-amber-300 px-3 py-2 text-[11px] font-semibold leading-none text-amber-800 transition hover:bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:hover:bg-amber-950/35 md:min-h-12 flex flex-col items-center justify-center gap-1"
                    aria-expanded={salePickerOpen}
                    onClick={() =>
                      setSalePickerOpen((v) => {
                        const next = !v;
                        if (!next) {
                          setShowOtherSaleOptions(false);
                          setCustomDiscountDraft("");
                        }
                        return next;
                      })
                    }
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                      <path d="M20.6 13.4L12.4 21.6a2 2 0 0 1-2.8 0L2.4 14.4a2 2 0 0 1 0-2.8L10.6 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v7a2 2 0 0 1-.4 1.2z" />
                      <circle cx="16.5" cy="7.5" r="1.25" />
                    </svg>
                    Discount
                  </button>
                ) : null}
                {typeof onEditListing === "function" ? (
                  <button
                    type="button"
                    className="min-h-[56px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold leading-none text-neutral-800 transition hover:bg-neutral-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 md:min-h-12 flex flex-col items-center justify-center gap-1"
                    onClick={() => onEditListing()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                    Edit listing
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasBuyerHandlers ? (
            <div
              className={
                hasSellerHandlers ? "mt-2 border-t border-neutral-200/50 pt-2 dark:border-[#1f3c56]/55" : ""
              }
            >
              <div className="flex w-full flex-row items-stretch gap-2">
                {typeof onAddToCart === "function" ? (
                  <button
                    type="button"
                    className="min-h-[56px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-semibold leading-none text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 md:min-h-12 flex flex-col items-center justify-center gap-1"
                    disabled={isOutOfStock}
                    onClick={() => onAddToCart()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                      <circle cx="9" cy="20" r="1" />
                      <circle cx="17" cy="20" r="1" />
                      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H7.1" />
                    </svg>
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
                    aria-label={isOutOfStock ? "Out of stock" : "Place order"}
                    className={`min-h-[56px] flex-1 rounded-lg bg-brand-primary px-3 py-2 text-[11px] font-semibold leading-none text-white shadow-sm shadow-brand-primary/15 transition dark:text-slate-900 dark:shadow-none md:min-h-12 flex flex-col items-center justify-center gap-1 ${
                      isOutOfStock
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-brand-primary/90 dark:hover:bg-brand-accent/90"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={isOutOfStock}
                    onClick={() => onBuyNow()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                      <path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z" />
                      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                    </svg>
                    {isOutOfStock ? "Out of stock" : "Place order"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!showActionFooter ? (
            <div className="flex justify-stretch md:justify-end">
              <button
                type="button"
                className="btn-primary touch-manipulation w-full md:w-auto md:min-w-[7rem] min-h-[56px] md:min-h-12 text-[11px] leading-none flex flex-col items-center justify-center gap-1"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
