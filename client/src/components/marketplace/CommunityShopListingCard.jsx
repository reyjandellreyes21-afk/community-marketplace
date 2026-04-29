import { useEffect, useRef, useState } from "react";
import { getListingCategoryShortLabel } from "../../categoryNav.js";
import { UI_KIT } from "../../lib/appUiKit.js";
import { SALE_PERCENT_OPTIONS } from "../../lib/listingSaleMeta.js";
import { ProductListingMedia } from "../media/ProductListingMedia.jsx";
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
  /** Mobile community shop grid: tuck Sale/Edit into overflow so buyer-style browse stays primary. */
  mobileOwnerActionsInMenu = false,
  /** Lighter image chrome (mobile shop browse). */
  softBrowseChrome = false,
  /** Mobile 2-col grid: omit description block for shorter, even rows; list mode ignores this. */
  browseSummaryGrid = false,
  /** Mobile marketplace browse: tighter grid/list density, aspect images, secondary owner CTAs. */
  mobileCardUx = false,
}) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef(null);
  const [customSalePercent, setCustomSalePercent] = useState("");
  const [showAllSaleOptions, setShowAllSaleOptions] = useState(false);
  const categoryShortLabel = getListingCategoryShortLabel(listing.verticalId, listing.subId);
  const isOwner = String(listing.sellerId || "") === String(currentUserId || "");
  const stockQty = Math.max(0, Number(listing.quantity) || 0);
  const isOutOfStock = stockQty <= 0;
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

  const pad = useFeedLayout ? "p-0" : gridMode && compactGrid ? "p-2.5" : gridMode ? "p-2.5" : "p-3.5";
  const imgBox = useFeedLayout
    ? compactGrid
      ? "h-28 max-h-28 w-full min-h-0 !aspect-auto overflow-hidden"
      : "aspect-square w-full min-h-0 overflow-hidden"
    : gridMode && compactGrid
      ? "h-28 w-full"
      : gridMode && mobileUx
        ? "aspect-[4/3] w-full"
        : gridMode && softBrowseChrome
          ? "aspect-[4/3] w-full min-h-[7.5rem] max-h-[10.5rem] min-[640px]:max-h-[11rem] md:aspect-auto md:min-h-0 md:max-h-none"
          : gridMode
            ? /** Desktop / non-touch browse: flexible tile height. */
              "h-40 w-full min-[640px]:h-44 md:h-48"
            : mobileUx
              ? "aspect-[4/3] w-full min-[400px]:aspect-square min-[400px]:h-[7.5rem] min-[400px]:w-[7.5rem] min-[400px]:max-h-[7.5rem] min-[400px]:max-w-[7.5rem] min-[400px]:shrink-0"
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
  const ownerGridOverflow =
    Boolean(mobileOwnerActionsInMenu) && isOwner && gridMode && !isListMode && showActions;

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

  const imageInspectBtnClass =
    "lm-product-card--tap absolute inset-0 z-0 min-h-0 w-full border-0 bg-transparent p-0 text-left";

  return (
    <div
      id={listing?.id ? `listing-card-${String(listing.id)}` : undefined}
      className={`lm-card group relative transition duration-200 ease-in-out ${
        gridMode ? "lm-grid-card lm-product-card-grid" : "lm-list-card lm-product-card-list"
      } ${useFeedLayout ? "lm-product-card lm-product-card--feed" : ""} ${pad} ${gridMode ? "flex h-full min-h-0 flex-col" : ""}`}
    >
      <div
        className={`flex min-h-0 ${
          gridMode
            ? `flex-1 flex-col ${mainGap}`
            : mobileUx
              ? "flex flex-col gap-3 min-[400px]:flex-row min-[400px]:items-start min-[400px]:gap-3.5"
              : "flex-row items-start gap-3"
        }`}
      >
        <div className={`relative ${imgBox}`}>
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
          {imageOpensInspect ? (
            <button
              type="button"
              className={imageInspectBtnClass}
              aria-label={`View details: ${listing.title || "product"}`}
              onClick={() => onInspect?.()}
            >
              <ProductListingMedia
                listing={listing}
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
        <div
          className={`min-w-0 flex-1 ${
            useFeedLayout
              ? `lm-product-card-body ${compactGrid ? "!gap-1" : ""}`
              : gridMode
                ? `flex min-h-0 flex-col ${compactGrid ? "gap-1" : "gap-2"}`
                : mobileUx
                  ? "flex w-full min-w-0 flex-col gap-1.5 min-[400px]:min-w-0 min-[400px]:flex-1"
                  : "flex h-32 min-w-0 flex-col justify-between overflow-hidden"
          }`}
        >
          <MarketplaceProductDetailStack
            variant="card"
            browseStackMode={mobileUx ? (gridMode ? "gridMobile" : "listMobile") : null}
            compactListMeta={isListMode}
            title={listing.title || "Untitled product"}
            titleEnd={favoriteTitleEnd}
            priceCents={listing.priceCents}
            categoryLabel={categoryShortLabel}
            description={listing.description}
            fulfillmentModes={listing.fulfillmentModes}
            orderType={listing.orderType}
            processingTime={listing.processingTime}
            optionNameA={listing.optionNameA}
            optionValuesA={listing.optionValuesA}
            optionNameB={listing.optionNameB}
            optionValuesB={listing.optionValuesB}
            quantityRow={
              <div className="min-w-0">
                {isListMode ? null : <p className="product-meta-label">Stock</p>}
                <div className={`${isListMode ? "" : "mt-0.5"} flex flex-wrap items-center gap-2`}>
                  <p className={isListMode ? "text-[12px] font-medium leading-snug text-text-secondary dark:text-slate-300" : "product-meta-value"}>
                    {isListMode ? (
                      <>
                        <span className="font-semibold uppercase tracking-wide text-[10px] text-text-secondary/80 dark:text-slate-400">Stock</span>
                        <span className="mx-1 text-text-secondary/65 dark:text-slate-500">:</span>
                        <span className="tabular-nums font-semibold text-text-primary dark:text-slate-100">{stockQty}</span>
                      </>
                    ) : mobileUx && gridMode ? (
                      `Stock: ${stockQty}`
                    ) : (
                      stockQty
                    )}
                  </p>
                  {isOutOfStock ? (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 min-[380px]:text-xs dark:border-rose-500/50 dark:bg-rose-950/30 dark:text-rose-300">
                      Out of stock
                    </span>
                  ) : null}
                </div>
              </div>
            }
            hideDescription={Boolean(isListMode || (gridMode && (compactGrid || browseSummaryGrid)))}
          />
          {useFeedLayout && listing.cityLabel ? (
            <div className="lm-product-card-badge-row">
              {listing.cityLabel ? (
                <span className={`line-clamp-1 max-w-full ${UI_KIT.chipMuted} py-px text-[10px] leading-tight`}>
                  {listing.cityLabel}
                </span>
              ) : null}
            </div>
          ) : (
            <>
              {listing.cityLabel ? (
                <span
                  className={
                    mobileUx && gridMode ? `${UI_KIT.chipMuted} py-px text-[10px] leading-tight` : UI_KIT.chipMuted
                  }
                >
                  {listing.cityLabel}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      {showActions && !hideCardActionsOnMobile ? (
        <div className={`flex flex-col gap-2 ${gridMode ? (useFeedLayout ? "mt-auto px-2 pb-2 pt-1.5 min-[400px]:px-2.5 min-[400px]:pb-2.5" : "mt-auto pt-3") : "mt-3"}`}>
          {ownerGridOverflow ? (
            <div className="flex items-stretch gap-2">
              {onInspect ? (
                <button
                  type="button"
                  className={`min-h-[44px] flex-1 rounded-xl border border-brand-primary/35 bg-white font-semibold text-brand-primary transition hover:bg-brand-soft/80 dark:border-slate-600 dark:bg-slate-900 dark:text-brand-accent dark:hover:bg-slate-800 ${compactActionBtnClass}`}
                  title="Read full description and details"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect();
                  }}
                >
                  View details
                </button>
              ) : null}
              <div className="relative shrink-0" ref={ownerMenuRef}>
                <button
                  type="button"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-200/90 bg-white text-lg font-bold leading-none text-neutral-600 transition hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
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
                    className="absolute bottom-full right-0 z-30 mb-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-neutral-200/90 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
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
                      {saleOpen ? "Hide sale" : "Sale"}
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
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
          {onInspect && !isListMode && !(mobileUx && gridMode) ? (
            <button
              type="button"
              className={`rounded-lg border border-neutral-300 font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
                isListMode ? "h-10 flex-1 px-3 text-xs" : `w-full ${compactActionBtnClass}`
              }`}
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
            <div
              className={
                isListMode
                  ? "grid w-full grid-cols-3 gap-2"
                  : compactActionRowClass
              }
            >
              {isListMode && onInspect ? (
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-primary px-3 text-xs font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Read full description and details"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect();
                  }}
                >
                  View details
                </button>
              ) : null}
              <button
                type="button"
                className={`min-w-0 shadow-none transition duration-200 ease-in-out active:scale-[0.99] motion-reduce:active:scale-100 dark:active:scale-100 ${
                  mobileUx && !isListMode
                    ? `rounded-lg border border-rose-200/90 bg-rose-50/70 font-medium text-rose-900 hover:bg-rose-100/90 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/45 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                    : `rounded-xl bg-accent font-semibold text-white hover:bg-accent-hover dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
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
                Sale
              </button>
              <button
                type="button"
                className={`min-w-0 shadow-none transition duration-200 ease-in-out active:scale-[0.99] motion-reduce:active:scale-100 ${
                  mobileUx && !isListMode
                    ? `rounded-lg border border-neutral-200/90 bg-white font-medium text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
                      }`
                    : `rounded-xl bg-primary font-semibold text-white hover:bg-primary-hover dark:bg-brand-accent dark:text-slate-900 dark:hover:bg-brand-accent/90 ${
                        isListMode ? "h-10 w-full px-3 text-xs" : `w-full flex-1 ${compactActionBtnClass}`
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
            </div>
          ) : (
            <div
              className={
                isListMode
                  ? `grid w-full grid-cols-3 ${mobileUx ? "gap-2.5" : "gap-2"}`
                  : compactActionRowClass
              }
            >
              {isListMode && onInspect ? (
                <button
                  type="button"
                  className="h-10 w-full rounded-xl border border-primary px-3 text-xs font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Read full description and details"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect();
                  }}
                >
                  View details
                </button>
              ) : null}
              <button
                type="button"
                title={isOutOfStock ? undefined : "Keep shopping — review cart anytime"}
                className={`rounded-xl border border-primary font-semibold text-primary transition duration-200 ease-in-out hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-accent dark:text-brand-accent dark:hover:bg-slate-800/80 max-md:border-2 ${
                  mobileUx && isListMode ? "shadow-sm" : ""
                } ${
                  isListMode ? "h-10 w-full px-3 text-xs" : `flex-1 ${compactActionBtnClass}`
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
                className={`rounded-xl bg-primary font-bold text-white shadow-sm transition duration-200 ease-in-out dark:bg-brand-accent dark:text-slate-900 ${
                  isListMode ? "h-10 w-full px-3 text-xs" : `flex-1 ${compactActionBtnClass}`
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
            </div>
          )}
            </>
          )}
        </div>
      ) : null}
      {showActions && !hideCardActionsOnMobile && isOwner && saleOpen ? (
        <div className={gridMode ? (useFeedLayout ? "mt-2 shrink-0 px-2 pb-2 min-[400px]:px-2.5" : "mt-2 shrink-0") : "mt-2"}>
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-2 dark:border-rose-500/30 dark:bg-rose-500/10">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                placeholder="Custom %"
                className="h-8 w-24 rounded-md border border-rose-300/90 bg-white px-2 text-xs font-semibold text-rose-900 outline-none transition placeholder:text-rose-500/80 focus:border-rose-400 focus:ring-2 focus:ring-rose-300/40 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-100 dark:placeholder:text-rose-300/70"
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
                className="h-8 rounded-md border border-rose-300/90 bg-white px-2.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
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
                  className="h-8 rounded-md border border-rose-300/90 bg-white px-2.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
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
                    className="min-h-8 rounded-md border border-rose-300/90 bg-white px-2 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/30"
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
