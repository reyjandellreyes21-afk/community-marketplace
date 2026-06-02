/**
 * Shared `CommunityShopListingCard` props for Home › Community–style browse surfaces
 * (community shop, favorites, cart line items).
 */
export function communityBrowseListingCardProps({
  browseView,
  isMobileViewport,
  viewerCoords = null,
  isOwnListing = false,
  unseenAttention = false,
}) {
  return {
    viewerCoords,
    gridMode: browseView !== "list",
    compactGrid: browseView === "compact",
    mobileOwnerActionsInMenu: isMobileViewport && browseView !== "list",
    disableGallerySwipe: true,
    hideGalleryPageIndicators: false,
    softBrowseChrome: isMobileViewport,
    browseSummaryGrid: isMobileViewport && browseView === "grid",
    mobileCardUx: isMobileViewport,
    hideCardDescription: !isMobileViewport,
    mobileEntireCardTappable: isMobileViewport,
    showActions: isMobileViewport || isOwnListing,
    hideOwnerManageActions: true,
    unseenAttention,
  };
}

/** Map a cart API row to listing fields expected by `CommunityShopListingCard`. */
export function listingFromCartItem(item) {
  if (!item) return item;
  return {
    ...item,
    id: item.listingId ?? item.id,
    priceCents: item.unitPriceCents ?? item.priceCents,
    quantity: item.listingQuantity ?? item.quantity,
  };
}
