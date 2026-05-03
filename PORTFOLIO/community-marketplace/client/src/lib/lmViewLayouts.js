/**
 * LinkMart global list/grid layout helpers — class bundles defined in `src/index.css`
 * (`lm-list-layout*`, `lm-grid-layout*`, `lm-commerce-line-items*`).
 * Mobile marketplace grid cards compose `lm-product-card*` primitives on the card root
 * (see `CommunityShopListingCard` when `mobileCardUx && gridMode`).
 */

/** Parent hint for CSS hooks / overflow guardrails (`lm-view-list` | `lm-view-grid`). */
export function lmBrowseViewShellClass(view) {
  return view === "list" ? "lm-view-list" : "lm-view-grid";
}

/**
 * Community shop + marketplace browse: list, comfortable auto-fill, compact auto-fill, or mobile 2-col grid.
 */
export function communityBrowseGridClass(view, mobileTwoColumnBrowse = false) {
  if (view === "list") return "lm-list-layout";
  if (view === "compact") return "lm-grid-layout lm-grid-layout--browse-compact";
  if (mobileTwoColumnBrowse) return "lm-grid-layout lm-grid-layout--browse-mobile-2col";
  return "lm-grid-layout lm-grid-layout--browse-auto";
}

/** Saved favorites browse surfaces — align with community card breakpoints. */
export function favoritesGridClass(view) {
  if (view === "list") return "lm-grid-layout lm-grid-layout--favorites-list";
  if (view === "compact") return "lm-grid-layout lm-grid-layout--favorites-compact";
  return "lm-grid-layout lm-grid-layout--favorites-grid";
}

/** Profile snapshot + My listings: list stack vs comfortable vs dense auto-fill grids. */
export function sellerListingsGridClass(view) {
  if (view === "list") return "lm-list-layout lm-list-layout--seller-profile";
  if (view === "compact") {
    return [
      "lm-grid-layout lm-grid-layout--seller-compact",
      "grid-cols-1",
      "gap-1.5 md:gap-2",
      "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,10.25rem),1fr))]",
      "xl:[grid-template-columns:repeat(auto-fill,minmax(min(100%,11rem),1fr))]",
    ].join(" ");
  }
  return [
    "lm-grid-layout lm-grid-layout--seller-comfortable",
    "grid-cols-1",
    "gap-4 md:gap-5",
    "lg:[grid-template-columns:repeat(auto-fill,minmax(min(100%,10.75rem),1fr))]",
    "xl:[grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))]",
    "2xl:[grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]",
  ].join(" ");
}

/**
 * Cart / orders line-item grids: list stacks vs grid tiles.
 * Grid modes mirror community browse comfortable / compact auto-fill from `md` up (`index.css`).
 */
export function commerceFlowLineItemsClass(view, ctx = {}) {
  const variant = ctx.variant ?? "cart";

  if (view === "list") {
    if (variant === "orders") return "lm-commerce-line-items--list-orders";
    return "lm-commerce-line-items--list-cart";
  }

  if (variant === "orders") {
    if (view === "compact") return "lm-commerce-line-items--grid-compact";
    return "lm-commerce-line-items--grid-orders";
  }

  if (variant === "cart") {
    if (view === "compact") return "lm-commerce-line-items--grid-compact";
    return "lm-commerce-line-items--grid";
  }

  return "lm-commerce-line-items--grid";
}
