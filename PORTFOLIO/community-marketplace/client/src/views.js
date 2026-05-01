/** Logged-in app sections (single-page navigation until React Router is added). */
export const VIEWS = {
  BROWSE: "browse",
  /** Same listing grid as browse, scoped to one community — own “screen” like Orders vs Marketplace. */
  COMMUNITY_SHOP: "community_shop",
  /** Full-screen product details view (opened from listing cards). */
  PRODUCT_DETAIL: "product_detail",
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
  /** Seller hub: products and feedback snapshot. */
  SELLER: "seller",
  /** Add-to-cart screen (nav placeholder). */
  CART: "cart",
  /** Buyer purchases (orders with `role=buyer`). */
  MY_PURCHASES: "my_purchases",
  /** Community courier hub (presence, open deliveries, seller assigns neighbor) — separate from Orders. */
  COURIER: "courier",
};

/** Sub-navigation for `VIEWS.SELLER` (stored in App state `sellerTab`). */
export const SELLER_TABS = {
  PRODUCTS: "products",
  /** Profile seller hub: buyer feedback received (UI label: Feedback). */
  FEEDBACK: "feedback",
};

/** Sub-navigation for `VIEWS.COURIER` (stored in App state `courierTab`). */
export const COURIER_TABS = {
  /** Courier role: availability + claim open deliveries. */
  DELIVER: "deliver",
  /** Seller: assign a neighbor or self-deliver. */
  SELL: "sell",
  /** Buyer: suggest a neighbor courier for your purchase. */
  BUY: "buy",
};
