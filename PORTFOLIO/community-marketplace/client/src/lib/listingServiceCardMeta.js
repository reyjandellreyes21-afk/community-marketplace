import { getListingCategoryShortLabel } from "../categoryNav.js";
import { SERVICE_CATEGORY_OPTIONS } from "./serviceUploadConfig.js";
import { formatPesoWhole } from "./listingSaleMeta.js";
import { formatAvailabilityScheduleHuman } from "./serviceAvailabilitySchedule.js";

/** Resolve upload-time service subtype (e.g. `transport_services`) to a display label. */
export function getServiceCategoryDisplayLabel(listingLike, meta) {
  const id = String(listingLike?.subId ?? meta?.categoryId ?? "").trim();
  if (!id || id === "all") return "";
  const fromUpload = SERVICE_CATEGORY_OPTIONS.find((o) => o.id === id);
  if (fromUpload) return fromUpload.label;
  const vertical = String(listingLike?.verticalId ?? listingLike?.categories ?? "services").trim() || "services";
  return getListingCategoryShortLabel(vertical, id);
}

/** @param {{ verticalId?: string, categories?: string } | null | undefined} listingLike */
export function isServiceListing(listingLike) {
  const v = String(listingLike?.verticalId ?? listingLike?.categories ?? "")
    .trim()
    .toLowerCase();
  return v === "services";
}

/** Order rows whose listing snapshot was a service (`listingVerticalId` on the order). */
export function orderIsServiceListingBooking(o) {
  return String(o?.listingVerticalId || "").trim().toLowerCase() === "services";
}

/** Community transport / ride listings stay on the courier-style delivery flow. */
export function orderIsTransportServiceBooking(o) {
  return orderIsServiceListingBooking(o) && String(o?.listingSubId || "").trim() === "transport_services";
}

/** Most services use appointment-style states (not parcel self-delivery / “mark received” as a package). */
export function orderUsesAppointmentServiceFlow(o) {
  return orderIsServiceListingBooking(o) && !orderIsTransportServiceBooking(o);
}

/**
 * Split listings for profile sections: all goods under **Products**, services under **Services**,
 * **Shop** reserved for future community-shop-only listings (currently always empty — see `shop`).
 * (`communityId` on normal listings does not move them out of Products.)
 * @param {unknown[] | null | undefined} listings
 * @returns {{ products: unknown[], services: unknown[], shop: unknown[] }}
 */
export function partitionProfileSellerListings(listings) {
  const arr = Array.isArray(listings) ? listings : [];
  const products = [];
  const services = [];
  /** Future: listing-only shop shelf when upload supports it; keep empty for now. */
  const shop = [];
  for (const l of arr) {
    if (isServiceListing(l)) {
      services.push(l);
      continue;
    }
    products.push(l);
  }
  return { products, services, shop };
}

/**
 * Profile seller hub: single list ordered **products → services** (shop shelf appended when populated later).
 * @param {unknown[] | null | undefined} listings
 */
export function orderProfileSellerListings(listings) {
  const { products, services, shop } = partitionProfileSellerListings(listings);
  return [...products, ...services, ...shop];
}

/**
 * Sections for profile “Your listings” / another seller’s list.
 * **Products**: all non-service listings. **Services**: services. **Shop**: placeholder until shop upload exists.
 * @param {unknown[] | null | undefined} listings
 * @returns {{ id: 'products' | 'services' | 'shop', title: string, listings: unknown[] }[]}
 */
export function getProfileSellerListingSections(listings) {
  const arr = Array.isArray(listings) ? listings : [];
  const { products, services, shop } = partitionProfileSellerListings(arr);
  /** @type {{ id: 'products' | 'services' | 'shop', title: string, listings: unknown[] }[]} */
  const sections = [];
  if (products.length) sections.push({ id: "products", title: "Products", listings: products });
  if (services.length) sections.push({ id: "services", title: "Services", listings: services });
  if (arr.length > 0) sections.push({ id: "shop", title: "Shop", listings: shop });
  return sections;
}

function truncate(text, max) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function formatToggle(v) {
  return v ? "Yes" : "No";
}

/** Weekly schedule JSON (`{ "v": 1, "days": [...], ... }`) → readable line; otherwise unchanged. */
function formatServiceFieldValueForDisplay(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("{")) {
    const human = formatAvailabilityScheduleHuman(s);
    if (human) return human;
  }
  return s;
}

/**
 * Profile / seller card: main heading = category; highlighted line = specific service type
 * (transport “Service title” modes or listing title).
 * @returns {{ categoryTitle: string, typeLabel: string }}
 */
export function getServiceCardProfileHeader(listingLike) {
  if (!isServiceListing(listingLike)) {
    return { categoryTitle: "", typeLabel: "" };
  }
  const meta =
    listingLike?.serviceMeta && typeof listingLike.serviceMeta === "object" && !Array.isArray(listingLike.serviceMeta)
      ? listingLike.serviceMeta
      : null;
  const categoryTitle = getServiceCategoryDisplayLabel(listingLike, meta);
  const dyn =
    meta?.dynamicFields && typeof meta.dynamicFields === "object" && !Array.isArray(meta.dynamicFields)
      ? meta.dynamicFields
      : {};
  let typeFromDynamic = "";
  for (const [label, raw] of Object.entries(dyn)) {
    if (String(label || "").trim() !== "Service title") continue;
    let val = raw;
    if (Array.isArray(val)) val = val.map((x) => String(x || "").trim()).filter(Boolean).join(", ");
    else if (typeof val === "boolean") val = formatToggle(val);
    else val = String(val ?? "").trim();
    typeFromDynamic = truncate(val, 240);
    break;
  }
  const titleFallback = String(listingLike?.title || "").trim();
  const typeLabel = typeFromDynamic || titleFallback;
  return { categoryTitle, typeLabel };
}

/**
 * Main price line on **service** cards: show stored min–max range when present (not the listing midpoint `priceCents`).
 * Non-service listings: returns `null` (caller keeps using `formatPesoWhole(priceCents)`).
 * @returns {string | null}
 */
export function getServiceCardHeadlinePriceLabel(listingLike) {
  if (!isServiceListing(listingLike)) return null;
  const meta =
    listingLike?.serviceMeta && typeof listingLike.serviceMeta === "object" && !Array.isArray(listingLike.serviceMeta)
      ? listingLike.serviceMeta
      : null;
  const common = meta?.common && typeof meta.common === "object" && !Array.isArray(meta.common) ? meta.common : {};
  const minP = Number(common.priceRangeMinPesos);
  const maxP = Number(common.priceRangeMaxPesos);
  if (!Number.isFinite(minP) || !Number.isFinite(maxP) || minP < 0 || maxP < 0) {
    return null;
  }
  const minCents = Math.round(minP * 100);
  const maxCents = Math.round(maxP * 100);
  const listingCents = Math.round(Number(listingLike?.priceCents) || 0);

  if (maxCents <= 0) {
    if (minCents > 0) return formatPesoWhole(minCents);
    if (listingCents > 0) return formatPesoWhole(listingCents);
    return formatPesoWhole(0);
  }
  if (minCents <= 0) {
    return formatPesoWhole(maxCents);
  }
  if (minCents === maxCents) {
    return formatPesoWhole(minCents);
  }
  return `${formatPesoWhole(minCents)} – ${formatPesoWhole(maxCents)}`;
}

/**
 * Human-readable rows for service listing cards (seller inventory, browse, inspect).
 * **All** category `dynamicFields` are included (never truncated). Optional `maxRows` only caps
 * how many **common** rows (rate, area, …) appear after dynamics when space is tight.
 * Omit `maxRows` or pass `undefined` for full head + dynamics + common.
 * @param {{ verticalId?: string, categories?: string, serviceMeta?: object } | null | undefined} listingLike
 * @param {{ maxRows?: number | null, omitCategoryAndServiceTitle?: boolean }} [opts]
 * @returns {{ label: string, value: string }[]}
 */
export function getServiceCardSummaryRows(listingLike, { maxRows, omitCategoryAndServiceTitle = false } = {}) {
  if (!isServiceListing(listingLike)) return [];
  const meta =
    listingLike?.serviceMeta && typeof listingLike.serviceMeta === "object" && !Array.isArray(listingLike.serviceMeta)
      ? listingLike.serviceMeta
      : null;
  const common = meta?.common && typeof meta.common === "object" && !Array.isArray(meta.common) ? meta.common : {};

  const categoryLabel = getServiceCategoryDisplayLabel(listingLike, meta);
  /** @type {{ label: string, value: string }[]} */
  const head = [];
  if (!omitCategoryAndServiceTitle && categoryLabel) {
    head.push({ label: "Service category", value: categoryLabel });
  }

  const dyn =
    meta?.dynamicFields && typeof meta.dynamicFields === "object" && !Array.isArray(meta.dynamicFields)
      ? meta.dynamicFields
      : {};

  /** @type {{ label: string, value: string }[]} */
  const dynamicRows = [];
  for (const [label, raw] of Object.entries(dyn)) {
    const l = String(label || "").trim();
    if (!l) continue;
    if (omitCategoryAndServiceTitle && l === "Service title") continue;
    let val = raw;
    if (Array.isArray(val)) val = val.map((x) => String(x || "").trim()).filter(Boolean).join(", ");
    else if (typeof val === "boolean") val = formatToggle(val);
    else val = String(val ?? "").trim();
    val = formatServiceFieldValueForDisplay(val);
    if (!val) continue;
    dynamicRows.push({ label: l, value: truncate(val, 240) });
  }

  /** @type {{ label: string, value: string }[]} */
  const commonRows = [];

  const rt = String(common.rateType || "").trim();
  if (rt) commonRows.push({ label: "Rate", value: rt });

  const area = String(common.serviceArea || "").trim();
  if (area) commonRows.push({ label: "Service area", value: truncate(area, 96) });

  const sched = String(common.availabilitySchedule || "").trim();
  if (sched) {
    const schedDisplay = formatServiceFieldValueForDisplay(sched);
    if (schedDisplay) commonRows.push({ label: "Availability", value: truncate(schedDisplay, 160) });
  }

  const cp = String(common.contactPreference || "").trim();
  if (cp) commonRows.push({ label: "Contact", value: cp });

  const tags = Array.isArray(common.tags) ? common.tags.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (tags.length) {
    commonRows.push({ label: "Tags", value: truncate(tags.slice(0, 12).join(", "), 96) });
  }

  if (common.verifiedProvider === true) {
    commonRows.push({ label: "Verified", value: "Yes" });
  }

  const headAndDyn = [...head, ...dynamicRows];
  if (maxRows == null || maxRows === Infinity || !Number.isFinite(Number(maxRows))) {
    return [...headAndDyn, ...commonRows];
  }
  const cap = Math.max(0, Math.floor(Number(maxRows)));
  const slotForCommon = Math.max(0, cap - headAndDyn.length);
  return [...headAndDyn, ...commonRows.slice(0, slotForCommon)];
}
