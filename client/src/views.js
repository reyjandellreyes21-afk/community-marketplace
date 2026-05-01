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
  /** Seller orders from buyers (legacy persistence — prefer ACTIVITY + selling tab). */
  ORDERS: "orders",
  ABOUT: "about",
  TERMS: "terms",
  USERS: "users",
  /** Seller hub: products and feedback snapshot. */
  SELLER: "seller",
  /** Add-to-cart screen (nav placeholder). */
  CART: "cart",
  /** Buyer purchases (legacy persistence — prefer ACTIVITY + buying tab). */
  MY_PURCHASES: "my_purchases",
  /** Courier hub (legacy persistence — prefer ACTIVITY + courier tab). */
  COURIER: "courier",
  /** Purchases, sales, and courier coordination (single hub). */
  ACTIVITY: "activity",
};

/** Sub-navigation for `VIEWS.SELLER` (stored in App state `sellerTab`). */
export const SELLER_TABS = {
  PRODUCTS: "products",
  /** Profile seller hub: buyer feedback received (UI label: Feedback). */
  FEEDBACK: "feedback",
};

/** Sub-navigation for the courier area (Activity → Courier tab; stored in App state `courierTab`). Strip order: Deliver, Buying, Selling (mirrors Activity Buying → Selling). */
export const COURIER_TABS = {
  /** Courier role: availability + claim open deliveries. */
  DELIVER: "deliver",
  /** Buyer: suggest a neighbor courier (tab label: Buying). */
  BUY: "buy",
  /** Seller: assign or self-deliver (tab label: Selling). */
  SELL: "sell",
};

/** Primary tabs inside `VIEWS.ACTIVITY`. */
export const ACTIVITY_TABS = {
  BUYING: "buying",
  SELLING: "selling",
  COURIER: "courier",
};
