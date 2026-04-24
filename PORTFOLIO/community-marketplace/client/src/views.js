/** Logged-in app sections (single-page navigation until React Router is added). */
export const VIEWS = {
  BROWSE: "browse",
  /** Same listing grid as browse, scoped to one community — own “screen” like Orders vs Marketplace. */
  COMMUNITY_SHOP: "community_shop",
  MESSAGES: "messages",
  NOTIFICATIONS: "notifications",
  /** Saved listings and sellers — UI placeholder until favorites API exists. */
  FAVORITES: "favorites",
  PROFILE: "profile",
  MY_LISTINGS: "my_listings",
  ORDERS: "orders",
  ABOUT: "about",
  TERMS: "terms",
  USERS: "users",
  /** Seller hub: products and review. */
  SELLER: "seller",
  /** Local delivery (nav placeholder). */
  DELIVERY: "delivery",
};

/** Sub-navigation for `VIEWS.SELLER` (stored in App state `sellerTab`). */
export const SELLER_TABS = {
  PRODUCTS: "products",
  REVIEW: "review",
};
