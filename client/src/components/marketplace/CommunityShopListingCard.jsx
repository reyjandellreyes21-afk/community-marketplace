import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getListingCategoryShortLabel, getVerticalById } from "../../categoryNav.js";
import { formatPesoWhole, SALE_PERCENT_OPTIONS } from "../../lib/listingSaleMeta.js";
import { resolveListingGalleryUrls } from "../../lib/listingImageUrl.js";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
import { MarketplaceProductDetailStack } from "./MarketplaceProductDetailStack.jsx";
import { ListingServiceCardSummary } from "./ListingServiceCardSummary.jsx";
import { getServiceCardHeadlinePriceLabel, getServiceCardProfileHeader, isServiceListing } from "../../lib/listingServiceCardMeta.js";

/** Minimum horizontal movement (px) to count as swipe vs tap-to-view-details — aligned with `ProductInspectModal`. */
const CARD_GALLERY_SWIPE_MIN_PX = 48;

export function CommunityShopListingCard({
  listing,
  gridMode,
  compactGrid = false,
  isFavorite,
  onAdd,
  onBuy,
  /** Service listings: single primary booking action (falls back to `onBuy` if omitted). */
  onBook,
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
  /** Mobile community shop grid: tuck Sale/Edit into overflow so buyer-style browse stays primary. */
  mobileOwnerActionsInMenu = false,
  /** Lighter image chrome (mobile shop browse). */
  softBrowseChrome = false,
  /** Grid: omit description block; on web profile grid, use a square hero (same width and height). */
  browseSummaryGrid = false,
  /** Mobile marketplace browse: tighter grid/list density, aspect images, secondary owner CTAs. */
  mobileCardUx = false,
  /** Disable in-card gallery swipe/dots for specific contexts (e.g. Home > Community). */
  disableGallerySwipe = false,
  /** Favorites: hide multi-photo pill dots on the image and the mobile "1/2" counter (swipe may still work). */
  hideGalleryPageIndicators = false,
  /** Saved listing not yet “seen” after leaving Favorites (soft card highlight only). */
  unseenAttention = false,
  /** Profile → Products: delete listing (owner only). */
  onDelete,
  /** Profile (web/desktop): hide Edit / Discount / Delete on the card; use inspect modal instead. */
  hideOwnerManageActions = false,
  /** Home › Community & Profile › Products (mobile): entire card opens inspect like tapping Add to cart flow. */
  mobileEntireCardTappable = false,
  /** Hide inline description text in the product card body. */
  hideCardDescription = false,
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef(null);
  const [customSalePercent, setCustomSalePercent] = useState("");
  const [showAllSaleOptions, setShowAllSaleOptions] = useState(false);
  const categoryShortLabel = getListingCategoryShortLabel(listing.verticalId, listing.subId);
  const isOwner = String(listing.sellerId || "") === String(currentUserId || "");
  const isServiceCard = isServiceListing(listing);
  const serviceCardHeader = isServiceCard ? getServiceCardProfileHeader(listing) : { categoryTitle: "", typeLabel: "" };
  const serviceTitleLine = isServiceCard
    ? (serviceCardHeader.typeLabel || String(listing.title || "").trim() || "Untitled service")
    : "";
  const serviceCategoryPill =
    isServiceCard &&
    serviceCardHeader.categoryTitle &&
    String(serviceCardHeader.categoryTitle).trim() !== String(serviceTitleLine).trim()
      ? serviceCardHeader.categoryTitle
      : "";
  /** Same sky pill as service cards (`MarketplaceProductDetailStack` `titleHighlight`): main browse vertical, e.g. Food. */
  const productVerticalId = String(listing.verticalId ?? listing.categories ?? "").trim();
  let productCategoryPill = "";
  if (!isServiceCard && productVerticalId) {
    productCategoryPill = String(getVerticalById(productVerticalId)?.label || "").trim();
  }
  if (!isServiceCard && !productCategoryPill && categoryShortLabel) {
    productCategoryPill = String(categoryShortLabel).trim();
  }
  const productTitleTrim = String(listing.title || "").trim();
  if (
    productCategoryPill &&
    productTitleTrim &&
    productCategoryPill.toLowerCase() === productTitleTrim.toLowerCase()
  ) {
    productCategoryPill = "";
  }
  const stockQty = Math.max(0, Number(listing.quantity) || 0);
  const isOutOfStock = !isServiceCard && stockQty <= 0;
  const serviceBookHandler = typeof onBook === "function" ? onBook : typeof onBuy === "function" ? onBuy : null;
  const serviceHeadlinePrice =
    isServiceCard ? getServiceCardHeadlinePriceLabel(listing) ?? formatPesoWhole(listing.priceCents) : "";

  const galleryUrls = useMemo(() => resolveListingGalleryUrls(listing), [listing]);
  const galleryUrlsKey = galleryUrls.join("|");
  const galleryMulti = galleryUrls.length > 1;
  const canSwipeGallery = galleryMulti && !disableGallerySwipe;
  const [cardPhotoIdx, setCardPhotoIdx] = useState(0);
  const heroPointerStartRef = useRef({ x: 0, y: 0 });
  const suppressHeroClickRef = useRef(false);

  useEffect(() => {
    setCardPhotoIdx(0);
  }, [listing?.id, galleryUrlsKey]);

  const displayGallerySrc = galleryUrls[cardPhotoIdx] || galleryUrls[0] || "";

  const goCardGalleryPrev = useCallback(() => {
    setCardPhotoIdx((i) => Math.max(0, i - 1));
  }, []);
  const goCardGalleryNext = useCallback(() => {
    setCardPhotoIdx((i) => Math.min(galleryUrls.length - 1, i + 1));
  }, [galleryUrls.length]);

  const onCardHeroPointerDown = useCallback((e) => {
    heroPointerStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onCardHeroPointerUp = useCallback(
    (e) => {
      if (!canSwipeGallery) return;
      const dx = e.clientX - heroPointerStartRef.current.x;
      const dy = e.clientY - heroPointerStartRef.current.y;
      if (Math.abs(dx) >= CARD_GALLERY_SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
        suppressHeroClickRef.current = true;
        if (dx < 0) goCardGalleryNext();
        else goCardGalleryPrev();
      }
    },
    [canSwipeGallery, goCardGalleryNext, goCardGalleryPrev],
  );

  const onCardHeroInspectClick = useCallback(() => {
    if (suppressHeroClickRef.current) {
      suppressHeroClickRef.current = false;
      return;
    }
    onInspect?.();
  }, [onInspect]);

  const customSaleValue = Number(customSalePercent);
  const customSaleValid =
    Number.isFinite(customSaleValue) &&
    Number.isInteger(customSaleValue) &&
    customSaleValue >= 1 &&
    customSaleValue <= 99;

  const mobileUx = Boolean(mobileCardUx);
  /** Mobile marketplace grid / compact: dense feed tile + flush square hero */
  const useFeedLayout = Boolean(gridMode && mobileUx);
  /** Mobile: card CTAs live in the inspect modal; image opens details when handler exists. */
  const hideCardActionsOnMobile = Boolean(mobileUx && onInspect);
  const imageOpensInspect = Boolean(onInspect && mobileUx);
  /** Desktop/web: entire card opens details; mobile keeps prior gate so small screens still match image-tap UX unless `mobileEntireCardTappable`. */
  const wholeCardTapOpensInspect = Boolean(
    onInspect && (!mobileUx || (mobileEntireCardTappable && mobileUx)),
  );

  const onCardShellKeyDown = useCallback(
    (e) => {
      if (!wholeCardTapOpensInspect) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onCardHeroInspectClick();
      }
    },
    [wholeCardTapOpensInspect, onCardHeroInspectClick],
  );

  const pad = useFeedLayout ? "p-0" : gridMode && compactGrid ? "p-2.5" : gridMode ? "p-2.5" : "p-3.5";
  const imgBox = useFeedLayout
    ? compactGrid
      ? "h-28 max-h-28 w-full min-h-0 !aspect-auto overflow-hidden"
      : "aspect-square w-full min-h-0 overflow-hidden"
    : gridMode && compactGrid
      ? "h-28 w-full"
      : gridMode && browseSummaryGrid
        ? "aspect-square w-full min-h-0 overflow-hidden"
      : gridMode && mobileUx
        ? "aspect-[4/3] w-full"
        : gridMode && softBrowseChrome
          ? "aspect-[4/3] w-full min-h-[7.5rem] max-h-[10.5rem] min-[640px]:max-h-[11rem] md:aspect-auto md:min-h-0 md:max-h-none"
          : gridMode
            ? /** Desktop / non-touch browse: flexible tile height. */
              "h-40 w-full min-[640px]:h-44 md:h-48"
            : mobileUx
              ? "aspect-[4/3] w-full min-[360px]:aspect-square min-[360px]:h-[7.5rem] min-[360px]:w-[7.5rem] min-[360px]:max-h-[7.5rem] min-[360px]:max-w-[7.5rem] min-[360px]:shrink-0"
              : "h-32 w-32";
  /** Outer shell dimensions; `ProductListingMedia` fills via `absolute inset-0` */
  const mainGap = gridMode && compactGrid ? "gap-2" : gridMode ? "gap-2.5" : "gap-3";
  const compactActionBtnClass = compactGrid
    ? "flex h-10 items-center justify-center whitespace-nowrap px-2 text-xs font-semibold leading-snug"
    : "min-h-[44px] px-3 py-2 text-sm md:min-h-0 md:py-1.5 md:text-xs";
  const compactActionRowClass = compactGrid
    ? "grid w-full grid-cols-2 gap-2"
    : "flex w-full flex-col gap-2 md:flex-row md:items-stretch";
  const isListMode = !gridMode;
  /** Web/desktop list: compact action strip — mobile list keeps full-width stacked/grid buttons. */
  const listDesktopCompactActions = isListMode && !mobileUx;
  const hideOwnerManageOnCard = Boolean(hideOwnerManageActions && isOwner);
  const showOwnerManageOnCard = isOwner && !hideOwnerManageOnCard;
  const ownerGridOverflow =
    Boolean(mobileOwnerActionsInMenu) && showOwnerManageOnCard && gridMode && !isListMode && showActions;
  const showCardActionStrip =
    showActions && !hideCardActionsOnMobile && (showOwnerManageOnCard || !isOwner);

  useEffect(() => {
    if (!ownerMenuOpen) return undefined;
    const onDoc = (e) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target)) setOwnerMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [ownerMenuOpen]);

  /** Keep favorite action inline with title; no image overlay button. */
  const favoriteOverlayOnImage = false;

  /** Overlay favorite (compact grid): scales with thumbnail width. */
  const favoriteFabPosition = "right-[clamp(0.3rem,3.5%,0.65rem)] top-[clamp(0.3rem,3.5%,0.65rem)]";
  const favoriteFabSize =
    "box-border w-[clamp(2.75rem,min(20%,3.25rem),2.875rem)] max-h-[2.875rem] max-w-[2.875rem] min-h-[44px] min-w-[44px]";
  const favoriteFabSurface =
    "flex aspect-square shrink-0 items-center justify-center rounded-[var(--ui-radius)] border-0 bg-white/95 shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05] transition duration-200 ease-in-out hover:scale-[1.04] hover:ring-black/[0.08] active:scale-[0.98] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:bg-white/95 dark:ring-white/10 md:rounded-[26%] md:border md:border-black/[0.06] md:shadow-[0_2px_10px_rgba(15,23,42,0.11)] md:ring-0 dark:md:border-black/10";

  /** Inline favorite: soft square on phones; md+ may use a round chip. */
  const favoriteInlineSurface =
    "inline-flex aspect-square shrink-0 items-center justify-center rounded-[var(--ui-radius)] border-0 bg-white/95 shadow-none ring-1 ring-black/[0.06] transition duration-200 ease-in-out hover:ring-black/[0.1] active:scale-[0.97] touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:bg-white/95 dark:ring-white/10 md:rounded-full md:border md:border-black/[0.06] md:shadow-[0_1px_6px_rgba(15,23,42,0.08)] md:ring-0 dark:md:border-black/10";
  const favoriteInlineSize =
    mobileUx && gridMode
      ? "box-border h-11 w-11 min-h-[44px] min-w-[44px] md:h-10 md:w-10 md:min-h-[2.5rem] md:min-w-[2.5rem]"
      : "box-border h-10 w-10 min-h-[2.5rem] min-w-[2.5rem]";

  const favoriteHeartSvg = (
    <svg className="h-[44%] w-[44%] shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isFavorite ? 0 : 2.125}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="nonScalingStroke"
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      />
    </svg>
  );

  const showFavoriteUi = false;

  const favoriteTitleEnd =
    showFavoriteUi && !favoriteOverlayOnImage ? (
      <button
        type="button"
        className={`${favoriteInlineSize} ${favoriteInlineSurface} ${
          isFavorite
            ? "text-[#ff4d6d]"
            : "text-[#ff4d6d]/75 hover:text-[#ff4d6d] dark:text-[#ff4d6d]/70 dark:hover:text-[#ff4d6d]"
        }`}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite?.();
        }}
      >
        {favoriteHeartSvg}
      </button>
    ) : null;

  const readOnlyStockRow = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-medium leading-snug text-text-secondary dark:text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-[10px] text-text-secondary/80 dark:text-slate-400">Stock</span>
          <span className="mx-1 text-text-secondary/65 dark:text-slate-500">:</span>
          <span className="tabular-nums font-semibold text-text-primary dark:text-slate-100">{stockQty}</span>
        </p>
        {isOutOfStock ? <span className="lm-tag-danger">Out of stock</span> : null}
      </div>
    </div>
  );

  const serviceBrowseSummary = (
    <div className="min-w-0">
      <ListingServiceCardSummary listing={listing} variant="browse" />
    </div>
  );

  const imageInspectBtnClass =
    "lm-product-card--tap absolute inset-0 z-0 min-h-0 w-full border-0 bg-transparent p-0 text-left";

  const shellAriaLabel =
    wholeCardTapOpensInspect && (isServiceCard ? serviceTitleLine : listing?.title)
      ? `View ${String((isServiceCard ? serviceTitleLine : listing.title) || "").trim() || "product"}`
      : wholeCardTapOpensInspect
        ? "View product"
        : undefined;

  return (
    <div
      id={listing?.id ? `listing-card-${String(listing.id)}` : undefined}
      role={wholeCardTapOpensInspect ? "button" : undefined}
      tabIndex={wholeCardTapOpensInspect ? 0 : undefined}
      aria-label={shellAriaLabel}
      className={`lm-card group relative transition duration-200 ease-in-out ${
        gridMode ? "lm-grid-card lm-product-card-grid" : "lm-list-card lm-product-card-list"
      } ${useFeedLayout ? "lm-product-card lm-product-card--feed" : ""} ${pad} ${gridMode ? "flex h-full min-h-0 flex-col" : ""} ${
        unseenAttention ? "bg-primary-soft dark:bg-primary/15" : ""
      } ${wholeCardTapOpensInspect ? "cursor-pointer" : ""}`}
      onClick={wholeCardTapOpensInspect ? onCardHeroInspectClick : undefined}
      onKeyDown={wholeCardTapOpensInspect ? onCardShellKeyDown : undefined}
    >
      <div
        className={`flex min-h-0 ${
          gridMode
            ? `flex-1 flex-col ${mainGap}`
            : mobileUx
              ? "flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-start min-[360px]:gap-3.5"
              : "flex-row items-start gap-3 md:gap-4"
        }`}
      >
        <div className={`${!gridMode && !mobileUx ? "shrink-0 " : ""}relative ${imgBox}`}>
          {favoriteOverlayOnImage ? (
            <button
              type="button"
              className={`absolute z-10 ${favoriteFabPosition} ${favoriteFabSize} ${favoriteFabSurface} ${
                isFavorite
                  ? "text-[#ff4d6d]"
                  : "text-[#ff4d6d]/75 hover:text-[#ff4d6d] dark:text-[#ff4d6d]/70 dark:hover:text-[#ff4d6d]"
              }`}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={isFavorite}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.();
              }}
            >
              {favoriteHeartSvg}
            </button>
          ) : null}
          {canSwipeGallery && !hideGalleryPageIndicators ? (
            <div
              className="pointer-events-none absolute bottom-1.5 left-0 right-0 z-[5] flex justify-center gap-1"
              aria-hidden
            >
              {galleryUrls.map((_, i) => (
                <span
                  key={`${listing?.id || "l"}-ph-${i}`}
                  className={`h-1 w-1 rounded-full shadow-sm ${i === cardPhotoIdx ? "bg-white" : "bg-white/55"}`}
                />
              ))}
            </div>
          ) : null}
          {imageOpensInspect && wholeCardTapOpensInspect ? (
            <div
              data-allow-tab-swipe
              className={imageInspectBtnClass}
              style={canSwipeGallery ? { touchAction: "manipulation" } : undefined}
              onPointerDown={canSwipeGallery ? onCardHeroPointerDown : undefined}
              onPointerUp={canSwipeGallery ? onCardHeroPointerUp : undefined}
              role="presentation"
            >
              <ProductListingMedia
                listing={listing}
                src={displayGallerySrc}
                galleryIndex={cardPhotoIdx}
                variant={gridMode ? "grid" : "list"}
                feed={useFeedLayout}
                fillFrame={Boolean(gridMode && !useFeedLayout)}
                softChrome={Boolean(softBrowseChrome && !useFeedLayout)}
                ring={Boolean(useFeedLayout && softBrowseChrome)}
                className="pointer-events-none absolute inset-0 min-h-0"
                sizes="(max-width: 767px) 45vw, min(240px, 18vw)"
                loading="lazy"
              />
            </div>
          ) : imageOpensInspect ? (
            <button
              type="button"
              data-allow-tab-swipe
              className={imageInspectBtnClass}
              aria-label={
                canSwipeGallery
                  ? `View details: ${listing.title || "product"}. Swipe photo left or right for more images.`
                  : `View details: ${listing.title || "product"}`
              }
              style={canSwipeGallery ? { touchAction: "manipulation" } : undefined}
              onPointerDown={canSwipeGallery ? onCardHeroPointerDown : undefined}
              onPointerUp={canSwipeGallery ? onCardHeroPointerUp : undefined}
              onClick={onCardHeroInspectClick}
            >
              <ProductListingMedia
                listing={listing}
                src={displayGallerySrc}
                galleryIndex={cardPhotoIdx}
                variant={gridMode ? "grid" : "list"}
                feed={useFeedLayout}
                fillFrame={Boolean(gridMode && !useFeedLayout)}
                softChrome={Boolean(softBrowseChrome && !useFeedLayout)}
                ring={Boolean(useFeedLayout && softBrowseChrome)}
                className="pointer-events-none absolute inset-0 min-h-0"
                sizes="(max-width: 767px) 45vw, min(240px, 18vw)"
                loading="lazy"
              />
            </button>
          ) : canSwipeGallery ? (
            <div
              className="absolute inset-0 min-h-0"
              style={{ touchAction: "manipulation" }}
              onPointerDown={onCardHeroPointerDown}
              onPointerUp={onCardHeroPointerUp}
            >
              <ProductListingMedia
                listing={listing}
                src={displayGallerySrc}
                galleryIndex={cardPhotoIdx}
                variant={gridMode ? "grid" : "list"}
                feed={useFeedLayout}
                fillFrame={Boolean(gridMode && !useFeedLayout)}
                softChrome={Boolean(softBrowseChrome && !useFeedLayout)}
                ring={Boolean(useFeedLayout && softBrowseChrome)}
                className="pointer-events-none absolute inset-0 min-h-0"
                sizes="(max-width: 767px) 45vw, min(240px, 18vw)"
                loading="lazy"
              />
            </div>
          ) : (
            <ProductListingMedia
              listing={listing}
              variant={gridMode ? "grid" : "list"}
              feed={useFeedLayout}
              fillFrame={Boolean(gridMode && !useFeedLayout)}
              softChrome={Boolean(softBrowseChrome && !useFeedLayout)}
              ring={Boolean(useFeedLayout && softBrowseChrome)}
              className="absolute inset-0 min-h-0"
              sizes="(max-width: 767px) 45vw, min(240px, 18vw)"
              loading="lazy"
            />
          )}
        </div>
        {mobileUx && canSwipeGallery && !hideGalleryPageIndicators ? (
          <p
            className="w-full min-w-0 text-center text-[10px] font-semibold tabular-nums text-neutral-500 dark:text-slate-400 md:hidden"
            aria-live="polite"
          >
            {cardPhotoIdx + 1}/{galleryUrls.length}
          </p>
        ) : null}
        <div
          className={`min-w-0 flex-1 ${
            useFeedLayout
              ? `lm-product-card-body ${compactGrid ? "!gap-1" : ""}`
              : gridMode
                ? `flex min-h-0 flex-col ${compactGrid ? "gap-1" : "gap-2"}`
                : mobileUx
                  ? "flex w-full min-w-0 flex-col gap-1.5 min-[360px]:min-w-0 min-[360px]:flex-1"
                  : "flex min-w-0 flex-1 flex-col gap-2"
          }`}
        >
          <MarketplaceProductDetailStack
            variant="card"
            browseStackMode={mobileUx ? "listMobile" : null}
            compactListMeta={isListMode || mobileUx}
            title={isServiceCard ? serviceTitleLine : listing.title || "Untitled product"}
            titleHighlight={isServiceCard ? serviceCategoryPill : productCategoryPill}
            titleEnd={favoriteTitleEnd}
            headlinePriceOverride={isServiceCard ? serviceHeadlinePrice : ""}
            priceCents={listing.priceCents}
            categoryLabel=""
            description={listing.description}
            fulfillmentModes={listing.fulfillmentModes}
            orderType={listing.orderType}
            processingTime={listing.processingTime}
            optionNameA=""
            optionValuesA={[]}
            optionNameB=""
            optionValuesB={[]}
            quantityRow={isServiceCard ? serviceBrowseSummary : readOnlyStockRow}
            hideAvailability={isServiceCard}
            omitProductMetaExtras={isServiceCard}
            hideDescription={Boolean(hideCardDescription || isListMode || (gridMode && (compactGrid || browseSummaryGrid)))}
            listingAvgRating={listing.listingAvgRating}
            listingReviewCount={listing.listingReviewCount}
          />
        </div>
      </div>
      {listing.cityLabel ? (
        <div className={useFeedLayout ? "px-2 pb-2 min-[360px]:px-2.5 min-[360px]:pb-2.5" : ""}>
          <div className="mt-2 border-t border-neutral-200/80 pt-2 dark:border-slate-600/55">
            <p
              className={`line-clamp-1 min-w-0 text-neutral-600 dark:text-slate-400 ${
                mobileUx && gridMode ? "text-[10px] leading-tight" : "text-[11px] leading-snug"
              }`}
            >
              {listing.cityLabel}
            </p>
          </div>
        </div>
      ) : null}
      {showCardActionStrip ? (
        <div
          className={`flex flex-col gap-2 ${gridMode ? (useFeedLayout ? "mt-auto px-2 pb-2 pt-1.5 min-[360px]:px-2.5 min-[360px]:pb-2.5" : "mt-auto pt-3") : listDesktopCompactActions ? "mt-3 border-t border-neutral-200/70 pt-3 dark:border-slate-600/55" : "mt-3"}`}
        >
          {ownerGridOverflow ? (
            <div className="flex w-full items-stretch justify-end gap-2">
              <div className="relative shrink-0" ref={ownerMenuRef}>
                <button
                  type="button"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-none border border-neutral-200/90 bg-white text-lg font-bold leading-none text-neutral-600 transition hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Listing options"
                  aria-expanded={ownerMenuOpen}
                  aria-haspopup="menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOwnerMenuOpen((o) => !o);
                  }}
                >
                  ···
                </button>
                {ownerMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute bottom-full right-0 z-30 mb-1 min-w-[10.5rem] overflow-hidden rounded-none border border-neutral-200/90 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSaleOpen((prev) => {
                          const next = !prev;
                          if (!next) {
                            setCustomSalePercent("");
                            setShowAllSaleOptions(false);
                          }
                          return next;
                        });
                        setOwnerMenuOpen(false);
                      }}
                    >
                      {saleOpen ? "Hide discount" : "Discount"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold text-brand-primary transition hover:bg-brand-soft/60 dark:text-brand-accent dark:hover:bg-slate-800"
                      title="Edit title, price, photos, and stock"
                      aria-label={`Edit listing: ${listing.title || "product"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOwnerMenuOpen(false);
                        onEdit?.();
                      }}
                    >
                      Edit
                    </button>
                    {onDelete ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                        aria-label={`Delete listing: ${listing.title || "product"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOwnerMenuOpen(false);
                          onDelete();
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
          {showOwnerManageOnCard ? (
            <div
              className={
                isListMode
                  ? onDelete
                    ? listDesktopCompactActions
                      ? "flex w-full flex-wrap items-center justify-end gap-2"
                      : "grid w-full grid-cols-2 gap-2 md:grid-cols-4"
                    : listDesktopCompactActions
                      ? "flex w-full flex-wrap items-center justify-end gap-2"
                      : "grid w-full grid-cols-3 gap-2"
                  : onDelete
                    ? compactGrid
                      ? "grid w-full grid-cols-3 gap-2"
                      : "flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch"
                    : compactActionRowClass
              }
            >
              <button
                type="button"
                className={`min-w-0 shadow-none transition duration-200 ease-in-out active:scale-[0.99] motion-reduce:active:scale-100 ${
                  mobileUx && !isListMode
                    ? `rounded-none border border-neutral-200/90 bg-white font-medium text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                    : `rounded-none bg-primary font-semibold text-white hover:bg-primary-hover dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90 ${
                        listDesktopCompactActions
                          ? "inline-flex h-9 min-h-0 min-w-[7rem] shrink-0 items-center justify-center px-4 text-xs"
                          : isListMode
                            ? "h-10 w-full px-3 text-xs"
                            : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                }`}
                title="Edit title, price, photos, and stock"
                aria-label={`Edit listing: ${listing.title || "product"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`min-w-0 shadow-none transition duration-200 ease-in-out active:scale-[0.99] motion-reduce:active:scale-100 dark:active:scale-100 ${
                  mobileUx && !isListMode
                    ? `rounded-none border border-rose-200/90 bg-rose-50/70 font-medium text-rose-900 hover:bg-rose-100/90 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/45 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                    : `rounded-none bg-accent font-semibold text-white hover:bg-accent-hover dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400 ${
                        listDesktopCompactActions
                          ? "inline-flex h-9 min-h-0 min-w-[7rem] shrink-0 items-center justify-center px-4 text-xs"
                          : isListMode
                            ? "h-10 w-full px-3 text-xs"
                            : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                } ${
                  saleOpen ? "ring-2 ring-rose-400/45 ring-offset-1 ring-offset-white dark:ring-rose-400/35 dark:ring-offset-slate-900" : ""
                }`}
                title={saleOpen ? "Hide discount options" : "Apply a sale discount"}
                aria-expanded={saleOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setSaleOpen((prev) => {
                    const next = !prev;
                    if (!next) {
                      setCustomSalePercent("");
                      setShowAllSaleOptions(false);
                    }
                    return next;
                  });
                }}
              >
                Discount
              </button>
              {onDelete ? (
                <button
                  type="button"
                  className={`rounded-none border border-danger bg-danger font-semibold text-white shadow-none transition duration-200 ease-in-out hover:bg-danger-hover dark:border-rose-500/55 dark:bg-rose-950/45 dark:text-rose-100 dark:hover:bg-rose-950/60 ${
                    listDesktopCompactActions
                      ? "inline-flex h-9 min-h-0 min-w-[7rem] shrink-0 items-center justify-center px-4 text-xs"
                      : isListMode
                        ? "h-10 w-full px-3 text-xs"
                        : `w-full flex-1 ${compactActionBtnClass}`
                  }`}
                  aria-label={`Delete listing: ${listing.title || "product"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className={
                isListMode
                  ? listDesktopCompactActions
                    ? "flex w-full flex-wrap items-center justify-end gap-2"
                    : isServiceCard
                      ? `grid w-full grid-cols-2 ${mobileUx ? "gap-2.5" : "gap-2"}`
                      : `grid w-full grid-cols-3 ${mobileUx ? "gap-2.5" : "gap-2"}`
                  : compactActionRowClass
              }
            >
              {isServiceCard && serviceBookHandler ? (
                <button
                  type="button"
                  title={
                    buyNowDisabled && buyNowDisabledReason
                      ? buyNowDisabledReason
                      : "Request a booking — add preferred time in your note"
                  }
                  aria-label={buyNowDisabled ? "Booking unavailable" : "Book"}
                  className={`rounded-none bg-primary font-bold text-white shadow-sm transition duration-200 ease-in-out dark:bg-brand-accent dark:text-slate-900 ${
                    listDesktopCompactActions
                      ? "inline-flex h-9 min-h-0 min-w-[7.5rem] shrink-0 items-center justify-center px-4 text-xs"
                      : isListMode
                        ? "h-10 w-full px-3 text-xs"
                        : `flex-1 ${compactActionBtnClass}`
                  } ${
                    buyNowDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-primary-hover dark:hover:bg-brand-accent/90"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={buyNowDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    serviceBookHandler();
                  }}
                >
                  Book
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    title={isOutOfStock ? undefined : "Keep shopping — review cart anytime"}
                    className={`rounded-none border border-primary font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-accent dark:text-brand-accent dark:hover:bg-slate-800/80 max-md:border-2 ${
                      mobileUx && isListMode ? "shadow-sm" : ""
                    } ${
                      listDesktopCompactActions
                        ? "inline-flex h-9 min-h-0 min-w-[7.5rem] shrink-0 items-center justify-center px-4 text-xs"
                        : isListMode
                          ? "h-10 w-full px-3 text-xs"
                          : `flex-1 ${compactActionBtnClass}`
                    }`}
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
                    className={`rounded-none bg-primary font-bold text-white shadow-sm transition duration-200 ease-in-out dark:bg-brand-accent dark:text-slate-900 ${
                      listDesktopCompactActions
                        ? "inline-flex h-9 min-h-0 min-w-[7.5rem] shrink-0 items-center justify-center px-4 text-xs"
                        : isListMode
                          ? "h-10 w-full px-3 text-xs"
                          : `flex-1 ${compactActionBtnClass}`
                    } ${
                      isOutOfStock
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-primary-hover dark:hover:bg-brand-accent/90"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={isOutOfStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBuy?.();
                    }}
                  >
                    {isOutOfStock ? "Out of stock" : "Buy now"}
                  </button>
                </>
              )}
            </div>
          )}
            </>
          )}
        </div>
      ) : null}
      {showCardActionStrip && showOwnerManageOnCard && saleOpen ? (
        <div className={gridMode ? (useFeedLayout ? "mt-2 shrink-0 px-2 pb-2 min-[360px]:px-2.5" : "mt-2 shrink-0") : "mt-2"}>
          <div className="rounded-none border border-rose-200/80 bg-rose-50/80 p-2 dark:border-rose-500/30 dark:bg-rose-500/10">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                placeholder="Custom %"
                className="h-8 w-24 rounded-none border border-rose-300/90 bg-white px-2 text-xs font-semibold text-rose-900 outline-none transition placeholder:text-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-300/40 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-100 dark:placeholder:text-rose-300/70"
                value={customSalePercent}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const digits = String(e.target.value || "").replace(/[^\d]/g, "");
                  if (digits === "") {
                    setCustomSalePercent("");
                    return;
                  }
                  setCustomSalePercent(String(Math.min(99, Number(digits))));
                }}
              />
              <button
                type="button"
                className="h-8 rounded-none border border-rose-300/90 bg-white px-2.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
                disabled={!customSaleValid}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!customSaleValid) return;
                  onSaleSelect?.(customSaleValue);
                  setCustomSalePercent("");
                  setShowAllSaleOptions(false);
                  setSaleOpen(false);
                }}
              >
                Apply
              </button>
              {SALE_PERCENT_OPTIONS.length > 0 ? (
                <button
                  type="button"
                  className="h-8 rounded-none border border-rose-300/90 bg-white px-2.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAllSaleOptions((prev) => !prev);
                  }}
                >
                  {showAllSaleOptions ? "Less" : "More"}
                </button>
              ) : null}
            </div>
            {showAllSaleOptions ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {SALE_PERCENT_OPTIONS.map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className="min-h-8 rounded-none border border-rose-300/90 bg-white px-2 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaleSelect?.(percent);
                      setCustomSalePercent("");
                      setShowAllSaleOptions(false);
                      setSaleOpen(false);
                    }}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
