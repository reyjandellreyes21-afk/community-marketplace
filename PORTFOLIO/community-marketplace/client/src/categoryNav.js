/**
 * Top-level marketplace categories and sub-categories (browse + listing form source of truth).
 * Ids are stable for API `vertical_id` filters (max 32 chars).
 */

/** @typedef {{ id: string, label: string }} CategorySub */
/** @typedef {{ id: string, label: string, subs: CategorySub[] }} CategoryVertical */

/** @type {CategoryVertical[]} */
export const VERTICALS = [
  {
    id: "groceries",
    label: "Groceries",
    subs: [
      { id: "all", label: "All in groceries" },
      { id: "fresh_ingredients", label: "Fresh and ingredients" },
      { id: "ready_to_eat", label: "Ready-to-eat and meals" },
      { id: "snacks", label: "Snacks and packaged" },
      { id: "beverages", label: "Beverages and juice" },
    ],
  },
  {
    id: "home_living",
    label: "Home & Living",
    subs: [
      { id: "all", label: "All home & living" },
      { id: "furniture", label: "Furniture" },
      { id: "decor", label: "Decor and lighting" },
      { id: "kitchen_dining", label: "Kitchen and dining" },
      { id: "bedding", label: "Bedding and bath" },
      { id: "storage", label: "Storage and organization" },
      { id: "garden", label: "Garden and outdoor living" },
    ],
  },
  {
    id: "food",
    label: "Food",
    subs: [
      { id: "all", label: "All food" },
      { id: "home_cooked", label: "Home-cooked meals" },
      { id: "ready_to_eat", label: "Ready-to-eat meals" },
      { id: "snacks_desserts", label: "Snacks and desserts" },
      { id: "beverages", label: "Drinks and beverages" },
    ],
  },
  {
    id: "services",
    label: "Services",
    subs: [
      { id: "all", label: "All services" },
      { id: "construction", label: "Construction and building" },
      { id: "yard_grass", label: "Yard work and grass cutting" },
      { id: "cleaning", label: "Cleaning services" },
      { id: "home_repairs", label: "Home repairs and installs" },
      { id: "moving_help", label: "Moving and hauling" },
      { id: "labor_general", label: "General labor and odd jobs" },
    ],
  },
  {
    id: "health_beauty",
    label: "Health & Beauty",
    subs: [
      { id: "all", label: "All health & beauty" },
      { id: "skincare", label: "Skincare" },
      { id: "hair", label: "Hair care" },
      { id: "makeup", label: "Makeup" },
      { id: "wellness", label: "Wellness and personal care" },
    ],
  },
  {
    id: "baby_kids",
    label: "Baby & Kids",
    subs: [
      { id: "all", label: "All baby & kids" },
      { id: "gear", label: "Gear and strollers" },
      { id: "clothing", label: "Clothing" },
      { id: "toys", label: "Toys and learning" },
      { id: "feeding", label: "Feeding and nursery" },
    ],
  },
  {
    id: "jobs_gigs",
    label: "Jobs / Gigs",
    subs: [
      { id: "all", label: "All jobs & gigs" },
      { id: "full_time", label: "Full-time roles" },
      { id: "part_time", label: "Part-time and shifts" },
      { id: "freelance", label: "Freelance and project" },
      { id: "errands", label: "Errands and same-day help" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    subs: [
      { id: "all", label: "All electronics" },
      { id: "phones", label: "Phones and accessories" },
      { id: "computers", label: "Computers and tablets" },
      { id: "audio", label: "Audio and wearables" },
      { id: "home_appliances", label: "Home appliances" },
    ],
  },
  {
    id: "books_school",
    label: "Books & School",
    subs: [
      { id: "all", label: "All books & school" },
      { id: "textbooks", label: "Textbooks and reviewers" },
      { id: "fiction", label: "Fiction and non-fiction" },
      { id: "stationery", label: "Stationery and supplies" },
      { id: "electronics_school", label: "School electronics" },
    ],
  },
  {
    id: "property",
    label: "Property",
    subs: [
      { id: "all", label: "All property" },
      { id: "for_sale", label: "For sale" },
      { id: "rentals", label: "Rentals" },
      { id: "commercial", label: "Commercial" },
      { id: "land", label: "Land" },
      { id: "new_developments", label: "New developments" },
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    subs: [
      { id: "all", label: "All vehicles" },
      { id: "cars", label: "Cars" },
      { id: "motorcycles", label: "Motorcycles" },
      { id: "parts", label: "Parts and accessories" },
      { id: "bicycles", label: "Bicycles and e-bikes" },
    ],
  },
  {
    id: "pets",
    label: "Pets",
    subs: [
      { id: "all", label: "All pets" },
      { id: "supplies", label: "Food and supplies" },
      { id: "accessories", label: "Accessories and care" },
      { id: "pet_grooming", label: "Grooming and services" },
    ],
  },
  {
    id: "fashion",
    label: "Fashion",
    subs: [
      { id: "all", label: "All fashion" },
      { id: "apparel", label: "Apparel" },
      { id: "bags_wallets", label: "Bags and wallets" },
      { id: "footwear", label: "Footwear" },
      { id: "accessories", label: "Accessories and watches" },
    ],
  },
  {
    id: "sports_outdoor",
    label: "Sports & Outdoor",
    subs: [
      { id: "all", label: "All sports & outdoor" },
      { id: "fitness", label: "Fitness and training" },
      { id: "team_sports", label: "Team sports" },
      { id: "camping", label: "Camping and hiking" },
      { id: "water_sports", label: "Water sports" },
    ],
  },
];

export const DEFAULT_VERTICAL_ID = VERTICALS[0]?.id ?? "groceries";

/** @param {string | null | undefined} verticalId */
export function getVerticalById(verticalId) {
  return VERTICALS.find((v) => v.id === verticalId) ?? null;
}

/**
 * Human-readable browse scope for placeholders and headings.
 * @param {string | null | undefined} verticalId
 * @param {string | null | undefined} subId - null means only vertical was chosen (overview); use explicit "all" sub where offered in menus.
 */
export function formatBrowseLabel(verticalId, subId) {
  if (verticalId == null || verticalId === "") {
    return "All categories";
  }
  const v = getVerticalById(verticalId);
  if (!v) return "Browse";
  if (subId == null || subId === "") {
    return `${v.label} — Overview`;
  }
  const sub = v.subs.find((s) => s.id === subId);
  if (!sub) return v.label;
  return `${v.label} — ${sub.label}`;
}

/**
 * Short label for product cards (vertical + optional sub), or "" if unknown.
 */
export function getListingCategoryShortLabel(verticalId, subId) {
  const id = String(verticalId || "").trim();
  if (!id) return "";
  const v = getVerticalById(id);
  if (!v) return "";
  const sid = String(subId ?? "").trim();
  if (!sid || sid === "all") return v.label;
  const sub = v.subs?.find((s) => s.id === sid);
  return sub ? `${v.label} · ${sub.label}` : v.label;
}
