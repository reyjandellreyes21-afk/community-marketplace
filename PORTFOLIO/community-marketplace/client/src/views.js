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
  /** Authenticated: submit app experience / product feedback (separate DB from order reviews). */
  SEND_FEEDBACK: "send_feedback",
  TERMS: "terms",
  /** Privacy / Data Privacy Act (standalone screen; also embedded in Terms). */
  DATA_PRIVACY_ACT: "data_privacy_act",
  BEWARE_SCAMMERS: "beware_scammers",
  PROHIBITED_PRODUCTS: "prohibited_products",
  /** Change password (email/password accounts). */
  PASSWORD_SECURITY: "password_security",
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
  /** Profile seller hub: income/expense/inventory overview and manual external entries. */
  DASHBOARD: "dashboard",
  /** Profile seller hub: buyer feedback received (UI label: Feedback). */
  FEEDBACK: "feedback",
};

/** Legacy courier sub-tab ids (no longer used in UI; Activity → Courier is a single “Find deliveries” view). */
export const COURIER_TABS = {
  DELIVER: "deliver",
  ACTIVE: "active",
};

/** Primary tabs inside `VIEWS.ACTIVITY`. */
export const ACTIVITY_TABS = {
  BUYING: "buying",
  SELLING: "selling",
  /** Service listings and other bookable flows (orders whose listing `verticalId` is `services`). */
  BOOKING: "booking",
  COURIER: "courier",
};

/** Sub-tabs inside Activity → Courier (`courierHubTab` in App state). */
export const ACTIVITY_COURIER_SUBTABS = {
  TASKS: "tasks",
  /** Neighborhood leaderboard (courier engagement). */
  STATS: "stats",
  /** Buyer ratings after completed deliveries (parity with seller hub Feedback tab). */
  FEEDBACK: "feedback",
};
