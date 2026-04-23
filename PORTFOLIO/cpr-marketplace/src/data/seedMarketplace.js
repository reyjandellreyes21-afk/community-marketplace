/** Home starts with no catalog; products come from sellers / persisted state only. */
export const initialProducts = [];

const LEGACY_DEMO_PRODUCT_IDS = new Set(["p1", "p2", "p3", "p4"]);

/** Drops old bundled demo rows so home placeholders show after removing seed data. */
export function withoutLegacyDemoProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => !LEGACY_DEMO_PRODUCT_IDS.has(p.id));
}

/** Demo users; assign "admin" only via localStorage / backend — not from UI. */
export const initialUsers = [
  {
    id: "u-seed",
    name: "Demo Seller",
    email: "seller@cpr.local",
    password: "123456",
    roles: ["buyer", "seller"],
    likes: 0,
    likedByUserIds: [],
  },
];
