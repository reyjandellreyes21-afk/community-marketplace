import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { uploadCommunityCoverImage, uploadListingImage } from "../lib/communityImageStorage.js";
import { displayNameForStoragePath } from "../lib/storagePathLabel.js";
import { findConflictingCommunity, isLikelySameCommunityName } from "../lib/communityNameSimilarity.js";
import { doesProfileAddressMatchCommunity, parseCommaProfileAddress } from "../lib/profileListingCommunity.js";
import { variantSignatureFromBuyerComment } from "../lib/variantSignature.js";
import { computeCartLineSignature } from "../lib/cartLineSignature.js";
import {
  notifyCourierDeliveryFeedback,
  notifyCourierInvitation,
  notifyUserOrderEvent,
} from "../lib/orderNotifications.js";
import {
  findConflictingServiceBooking,
  effectiveServiceSlotFromOrderRow,
  listHeldServiceSlotsForListing,
  normalizeSlotDateIso,
  normalizeSlotTimeHm,
} from "../lib/serviceBookingHold.js";
import { formatServiceBookingRequestLine, validateServiceBookingSlotForOrder } from "../lib/serviceBookingSlot.js";

/** PostgREST: table missing from API schema (migrations not applied or `NOTIFY pgrst, 'reload schema';` needed). */
const isSchemaMissingError = (error) =>
  Boolean(error) &&
  (error.code === "PGRST205" || /schema cache/i.test(String(error.message || "")));

/** Missing table/modern columns on `order_reviews` (split schema expected by current API). */
const isOrderReviewsSchemaError = (error) => {
  if (!error) return false;
  if (isSchemaMissingError(error)) return true;
  const msg = String(error.message || "");
  const code = error.code;
  if (
    code === "PGRST204" &&
    /order_reviews|product_rating|seller_rating|product_review_text|seller_review_text|product_rating_started_at|seller_rating_started_at/i.test(
      msg,
    )
  )
    return true;
  if (
    /order_reviews/i.test(msg) &&
    /column|product_rating|seller_rating|product_review_text|seller_review_text|product_rating_started_at|seller_rating_started_at|could not find/i.test(
      msg,
    )
  )
    return true;
  return false;
};

/** Legacy schema missing (`rating`/`review_text`) when compatibility fallback is attempted. */
const isLegacyOrderReviewsSchemaError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  const code = String(error.code || "");
  if (code === "PGRST204" && /order_reviews|rating|review_text/i.test(msg)) return true;
  if (/order_reviews/i.test(msg) && /could not find.*(rating|review_text)|column.*(rating|review_text)/i.test(msg)) return true;
  return false;
};

/** Split schema present but 72h timer columns not yet migrated. */
const isOrderReviewTimerColumnMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  const code = String(error.code || "");
  if (code === "42703" && /product_rating_started_at|seller_rating_started_at/i.test(msg)) return true;
  if (code === "PGRST204" && /product_rating_started_at|seller_rating_started_at/i.test(msg)) return true;
  return /column|could not find/i.test(msg) && /product_rating_started_at|seller_rating_started_at/i.test(msg);
};

const isCourierReviewTimerColumnMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  const code = String(error.code || "");
  if (code === "42703" && /rating_started_at/i.test(msg)) return true;
  if (code === "PGRST204" && /rating_started_at/i.test(msg)) return true;
  return /column|could not find/i.test(msg) && /rating_started_at/i.test(msg);
};

const ORDER_REVIEWS_SETUP_HINT =
  "Apply supabase/migrations/20260507130000_ensure_order_reviews.sql and 20260508150000_order_reviews_product_seller_split.sql (or run the Order reviews section in supabase/sql_editor_all_in_one.sql), then execute: NOTIFY pgrst, 'reload schema';";

const COURIER_DELIVERY_REVIEWS_SETUP_HINT =
  "Create table courier_delivery_reviews: in Supabase SQL Editor run supabase/migrations/20260507140000_ensure_courier_delivery_reviews.sql (includes NOTIFY). Or locally: set DATABASE_URL in server/.env then npm run db:apply-courier-reviews (from server/). Or supabase db push.";

/**
 * Legacy compatibility: pre-split `order_reviews` used `rating` + `review_text`.
 * Keep saves working even if split columns are missing in the connected project.
 */
async function upsertOrderReviewLegacyRow({
  id,
  order,
  existing,
  pr,
  sr,
  productTextIn,
  sellerTextIn,
  productReviewText,
  sellerReviewText,
  now,
  resolvedListingIdForReview,
}) {
  const existingRating = existing?.rating != null ? Number(existing.rating) : null;
  const nextRating = pr.set ? pr.n : sr.set ? sr.n : Number.isFinite(existingRating) ? existingRating : null;
  if (nextRating == null) {
    throw new AppError(400, "At least one of product or seller ratings must be set.");
  }
  const existingText =
    existing?.review_text != null && String(existing.review_text).trim()
      ? String(existing.review_text).trim().slice(0, 2000)
      : null;
  const nextReviewText = sellerTextIn
    ? sellerReviewText || null
    : productTextIn
      ? productReviewText || null
      : existingText;

  if (existing?.id) {
    const { data: updated, error: uerr } = await supabaseAdmin
      .from("order_reviews")
      .update({
        rating: nextRating,
        review_text: nextReviewText,
        updated_at: now,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: resolvedListingIdForReview,
      })
      .eq("order_id", id)
      .select("*")
      .single();
    if (uerr) {
      if (isLegacyOrderReviewsSchemaError(uerr)) {
        throw new AppError(500, `Order reviews are not available (${ORDER_REVIEWS_SETUP_HINT})`);
      }
      throw new AppError(500, uerr.message);
    }
    return updated;
  }

  const { data: inserted, error: ierr } = await supabaseAdmin
    .from("order_reviews")
    .insert({
      order_id: id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      listing_id: resolvedListingIdForReview,
      rating: nextRating,
      review_text: nextReviewText,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (ierr) {
    if (isLegacyOrderReviewsSchemaError(ierr)) {
      throw new AppError(500, `Order reviews are not available (${ORDER_REVIEWS_SETUP_HINT})`);
    }
    throw new AppError(500, ierr.message);
  }
  return inserted;
}

const isBuyerCommentMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  return /buyer_comment/i.test(msg) && (error.code === "PGRST204" || /schema cache/i.test(msg));
};

const isVariantSignatureMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  return /variant_signature/i.test(msg) && (error.code === "PGRST204" || /schema cache/i.test(msg));
};

const isMissingProfilesNotifyCourierColumn = (error) =>
  /notify_courier_open_tasks/i.test(String(error?.message || "")) && /profiles|schema cache/i.test(String(error?.message || ""));
const isMissingProfilesPushTokenColumn = (error) =>
  /push_notification_token|push_notification_platform/i.test(String(error?.message || "")) &&
  /profiles|schema cache/i.test(String(error?.message || ""));

/** Validates requested fulfillment against `listing.fulfillment_modes`; picks default when omitted/invalid. */
function resolveBuyerFulfillmentForListing(listing, requested) {
  const modes =
    Array.isArray(listing?.fulfillment_modes) && listing.fulfillment_modes.length
      ? listing.fulfillment_modes.map(String)
      : ["pickup"];
  const raw = requested != null ? String(requested).trim() : "";
  if (raw === "pickup" || raw === "delivery") {
    if (!modes.includes(raw)) {
      throw new AppError(400, "This listing does not support that fulfillment option.");
    }
    return raw;
  }
  return modes.includes("pickup") ? "pickup" : modes[0];
}

/** Normalize stored DB value + listing modes for API consumers. */
function fulfillmentTypeForCartApiRow(row, listing) {
  const modes =
    Array.isArray(listing?.fulfillment_modes) && listing.fulfillment_modes.length
      ? listing.fulfillment_modes.map(String)
      : ["pickup"];
  let ft = row?.fulfillment_type != null ? String(row.fulfillment_type).trim() : "";
  if (ft !== "pickup" && ft !== "delivery") {
    ft = modes.includes("pickup") ? "pickup" : modes[0];
  }
  if (!modes.includes(ft)) {
    ft = modes.includes("pickup") ? "pickup" : modes[0];
  }
  return ft;
}

/** Matches cart line identity when `line_signature` is absent or PostgREST cache lags behind migrations. */
function effectiveLineSignatureFromCartRow(row, listing) {
  const stored = String(row?.line_signature ?? "").trim();
  if (/^[a-f0-9]{64}$/.test(stored)) return stored;
  const vs = String(row?.variant_signature ?? "").trim().slice(0, 512);
  const ft = fulfillmentTypeForCartApiRow(row, listing);
  const c = String(row?.comment ?? "").trim().slice(0, 2000);
  return computeCartLineSignature(vs, ft, c);
}

/** Public avatar URL from a `profiles` row (PostgREST uses snake_case; tolerate camelCase). */
function profileAvatarUrlFromRow(p) {
  if (!p || typeof p !== "object") return null;
  const raw = p.avatar_url ?? p.avatarUrl;
  const s = String(raw ?? "").trim();
  return s || null;
}

/** Prefer stored column; fall back to parsing buyer_comment (matches cart_items.variant_signature semantics). */
function effectiveVariantSignatureFromOrderRow(row) {
  const db = String(row?.variant_signature ?? "").trim();
  if (db) return db.slice(0, 512);
  return variantSignatureFromBuyerComment(String(row?.buyer_comment ?? ""));
}

/** PostgREST returns "Could not find the 'col' column of 'orders' in the schema cache" when migrations lag. */
const ORDERS_MISSING_COLUMN_RE = /Could not find the '([^']+)' column of 'orders'/i;
const ORDERS_MISSING_COLUMN_RE_DQ = /Could not find the "([^"]+)" column of "orders"/i;

/** PATCH fields that may be absent before migrations; stripped in order if PostgREST still rejects the update. */
const ORDER_UPDATE_OPTIONAL_COLUMNS = [
  "processing_entered_at",
  "completed_at",
  "cancelled_at",
  "cancelled_by_role",
  "cancellation_reason",
  "cancellation_note",
  "buyer_receipt_acknowledged_at",
  "buyer_comment",
  "variant_signature",
  "buyer_courier_contribution_cents",
  "seller_courier_contribution_cents",
];

/** PHP centavos — sanity cap for voluntary courier pool lines (no wallet). */
const MAX_COURIER_CONTRIBUTION_CENTS = 10_000_000;

function parseOptionalCourierContributionCents(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(400, "Courier contribution must be a non-negative integer (centavos).");
  }
  if (n > MAX_COURIER_CONTRIBUTION_CENTS) {
    throw new AppError(400, "Courier contribution exceeds maximum.");
  }
  return n;
}

function deliveryCodTotalFromSplit(buyerCents, sellerCents) {
  const b = Math.max(0, Math.floor(Number(buyerCents) || 0));
  const s = Math.max(0, Math.floor(Number(sellerCents) || 0));
  return b + s;
}

function orderHasAcceptedCommunityCourier(row) {
  const id = row?.accepted_courier_assignment_id ?? row?.accepted_bid_id;
  return Boolean(id);
}

/** Hide open courier tasks until pooled COD ≥ this many centavos (env; 100 ≈ ₱1). Default 0 = show all. */
function openDeliveryMinCourierCents() {
  const raw = process.env.OPEN_DELIVERY_MIN_COURIER_CENTS;
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const ALLOWED_ORDER_CANCELLATION_REASONS = new Set([
  "change_of_mind",
  "change_variant",
  "better_price_elsewhere",
  "placed_by_mistake",
  "other",
]);

function listingRowIsService(row) {
  const v = String(row?.vertical_id ?? row?.categories ?? "").trim().toLowerCase();
  return v === "services";
}

function postgrestErrorText(error) {
  if (!error) return "";
  const nested =
    typeof error === "object" && error.cause ? postgrestErrorText(error.cause) : "";
  return [error.message, error.details, error.hint, nested].filter(Boolean).join(" ").trim();
}

/** When `20260430125500_orders_status_milestone_timestamps` has not been applied yet. */
function isMissingOrdersCompletedAtColumn(error) {
  const t = postgrestErrorText(error);
  return (
    /completed_at/i.test(t) &&
    (/orders/i.test(t) || /[`'"]orders[`'"]/i.test(t)) &&
    (/does not exist/i.test(t) || /schema cache/i.test(t) || /could not find/i.test(t))
  );
}

/** PostgREST / unmigrated DB: `cart_items.fulfillment_type` from `20260503130000_cart_items_fulfillment_type.sql`. */
function isCartItemsMissingFulfillmentTypeColumnError(error) {
  const t = postgrestErrorText(error);
  if (!t) return false;
  return /fulfillment_type/i.test(t) && /cart_items/i.test(t);
}

/** PostgREST / unmigrated DB: `cart_items.line_signature` from `20260504130000_cart_items_line_signature.sql`. */
function isCartItemsMissingLineSignatureColumnError(error) {
  const t = postgrestErrorText(error);
  if (!t) return false;
  return (
    /line_signature/i.test(t) &&
    /cart_items/i.test(t) &&
    (/schema cache/i.test(t) || /does not exist/i.test(t) || /could not find/i.test(t))
  );
}

/** When `20260502120000_order_courier_contributions` has not been applied (or schema cache lags). */
function isMissingOrdersCourierContributionColumn(error) {
  const t = postgrestErrorText(error);
  return (
    /buyer_courier_contribution_cents|seller_courier_contribution_cents/i.test(t) &&
    (/orders/i.test(t) || /schema cache/i.test(t) || /could not find/i.test(t))
  );
}

/** When `20260512120000_courier_assignment_inviter_flags.sql` has not been applied (or schema cache lags). */
function isMissingCourierAssignmentInviterColumnsError(error) {
  const t = postgrestErrorText(error);
  return (
    /invited_by_buyer|invited_by_seller/i.test(t) &&
    (/courier_assignments/i.test(t) || /schema cache/i.test(t) || /could not find/i.test(t))
  );
}

function normalizeListingImageUrlKey(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    return new URL(s).href;
  } catch {
    return s;
  }
}

/** Preserve order; drop duplicate URLs (same resource after normalization). */
function dedupeListingImageUrlsOrdered(urls) {
  const seen = new Set();
  const out = [];
  for (const raw of urls || []) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) continue;
    const key = normalizeListingImageUrlKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

const LISTING_IMAGE_URLS_CAP = 6;

/**
 * Body sends `imageUrl` (cover) plus `imageUrls`. The client usually sends the **full gallery** in `imageUrls`
 * (cover first). Prefixing `primary` again would duplicate slot 1 and can shift/truncate to fewer than 6 unique URLs after dedupe.
 */
const DEFAULT_LISTING_FOCAL_RECT = Object.freeze({ cropLeft: 0, cropTop: 0, cropSize: 1 });

function clampFocal01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function sanitizeListingFocalRect(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return {
    cropLeft: clampFocal01(raw.cropLeft),
    cropTop: clampFocal01(raw.cropTop),
    cropSize: Math.min(1, Math.max(0.2, Number(raw.cropSize) || 1)),
  };
}

function normalizeDbImageFocalRects(raw, urlCount) {
  const n = Math.min(LISTING_IMAGE_URLS_CAP, Math.max(0, Number(urlCount) || 0));
  if (n === 0) return [];
  let arr = [];
  if (raw == null) arr = [];
  else if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    const t = raw.trim();
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = [];
      }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(sanitizeListingFocalRect(arr[i]) || DEFAULT_LISTING_FOCAL_RECT);
  }
  return out;
}

function mergePayloadListingImageFocalRects(bodyFocal, urlCount) {
  const n = Math.min(LISTING_IMAGE_URLS_CAP, Math.max(0, Number(urlCount) || 0));
  if (n === 0) return [];
  const raw = Array.isArray(bodyFocal) ? bodyFocal : [];
  return normalizeDbImageFocalRects(raw, n);
}

function mergePayloadListingImageUrls(primaryStr, rawUrlsIn) {
  const primary = String(primaryStr ?? "").trim();
  const rawUrls = Array.isArray(rawUrlsIn)
    ? rawUrlsIn.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  if (rawUrls.length === 0) {
    return dedupeListingImageUrlsOrdered(primary ? [primary] : []).slice(0, LISTING_IMAGE_URLS_CAP);
  }
  const first = rawUrls[0];
  if (primary && first && normalizeListingImageUrlKey(first) === normalizeListingImageUrlKey(primary)) {
    return dedupeListingImageUrlsOrdered(rawUrls).slice(0, LISTING_IMAGE_URLS_CAP);
  }
  return dedupeListingImageUrlsOrdered(primary ? [primary, ...rawUrls] : rawUrls).slice(0, LISTING_IMAGE_URLS_CAP);
}

/**
 * DB/json drivers may return `image_urls` as a native array, jsonb array, or a JSON string — normalize to ordered URLs.
 */
function normalizeDbImageUrls(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
      } catch {
        /* fall through to single URL */
      }
    }
    return [t];
  }
  return [];
}

/**
 * Normalize DB array-ish values to string[].
 * Supports native arrays, JSON-string arrays, and Postgres array literals like "{Small,Medium}".
 */
function normalizeDbTextArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof raw !== "string") return [];
  const t = raw.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {
      // continue to other parsers
    }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1);
    if (!inner.trim()) return [];
    const out = [];
    let cur = "";
    let inQuotes = false;
    let escaping = false;
    for (let i = 0; i < inner.length; i += 1) {
      const ch = inner[i];
      if (escaping) {
        cur += ch;
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        const v = cur.trim();
        if (v) out.push(v);
        cur = "";
        continue;
      }
      cur += ch;
    }
    const tail = cur.trim();
    if (tail) out.push(tail);
    return out.map((x) => String(x || "").trim()).filter(Boolean);
  }
  return [t];
}

const MAX_LISTING_OPTION_CHOICES = 30;

function normalizeUniqueChoiceList(raw) {
  const seen = new Set();
  const out = [];
  for (const x of raw || []) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= MAX_LISTING_OPTION_CHOICES) break;
  }
  return out;
}

function assertNoDuplicateChoicesInRequest(rawArray, fieldLabel) {
  if (!Array.isArray(rawArray)) return;
  const seen = new Set();
  for (const x of rawArray) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) {
      throw new AppError(400, `Duplicate ${fieldLabel} choice: "${s}".`);
    }
    seen.add(k);
  }
}

/**
 * Validates variant groups; trims choices; dedupes case-insensitively; max two groups via columns A/B.
 */
function validateListingVariantGroups(nameAIn, valsARaw, nameBIn, valsBRaw) {
  assertNoDuplicateChoicesInRequest(valsARaw, "first variant");
  assertNoDuplicateChoicesInRequest(valsBRaw, "second variant");
  const valsA = normalizeUniqueChoiceList(valsARaw);
  const valsB = normalizeUniqueChoiceList(valsBRaw);
  const na = String(nameAIn ?? "").trim().slice(0, 120);
  const nb = String(nameBIn ?? "").trim().slice(0, 120);

  if (valsA.length > 0 && !na) {
    throw new AppError(400, "Variant type is required when first variant choices are provided.");
  }
  if (valsB.length > 0 && !nb) {
    throw new AppError(400, "Second variant type is required when second variant choices are provided.");
  }
  if (na && valsA.length === 0) {
    throw new AppError(400, "Add at least one choice for the first variant, or clear the variant type.");
  }
  if (nb && valsB.length === 0) {
    throw new AppError(400, "Add at least one choice for the second variant, or clear the second variant type.");
  }
  if (na && nb && na.toLowerCase() === nb.toLowerCase()) {
    throw new AppError(400, "The two variant types must be different.");
  }

  return {
    option_name_a: na,
    option_values_a: valsA,
    option_name_b: nb,
    option_values_b: valsB,
  };
}

function mergeAndValidateListingVariants(body, existing) {
  const ex = existing || {};
  if (Array.isArray(body?.variants)) {
    if (body.variants.length > 2) {
      throw new AppError(400, "At most two variant groups are allowed.");
    }
    const g0 = body.variants[0];
    const g1 = body.variants[1];
    const nameA = g0 && typeof g0 === "object" && g0.type != null ? String(g0.type).trim().slice(0, 120) : "";
    const nameB = g1 && typeof g1 === "object" && g1.type != null ? String(g1.type).trim().slice(0, 120) : "";
    const valsA = g0 && Array.isArray(g0.choices) ? g0.choices : [];
    const valsB = g1 && Array.isArray(g1.choices) ? g1.choices : [];
    return validateListingVariantGroups(nameA, valsA, nameB, valsB);
  }

  const nameA =
    body.optionNameA !== undefined
      ? String(body.optionNameA).trim().slice(0, 120)
      : String(ex.option_name_a ?? "").trim();
  const nameB =
    body.optionNameB !== undefined
      ? String(body.optionNameB).trim().slice(0, 120)
      : String(ex.option_name_b ?? "").trim();
  /** Raw request arrays reject duplicates; existing DB rows are pre-deduped so PATCH metadata-only updates stay compatible with legacy data. */
  const valsA =
    body.optionValuesA !== undefined
      ? Array.isArray(body.optionValuesA)
        ? body.optionValuesA
        : []
      : normalizeUniqueChoiceList(normalizeDbTextArray(ex.option_values_a));
  const valsB =
    body.optionValuesB !== undefined
      ? Array.isArray(body.optionValuesB)
        ? body.optionValuesB
        : []
      : normalizeUniqueChoiceList(normalizeDbTextArray(ex.option_values_b));

  return validateListingVariantGroups(nameA, valsA, nameB, valsB);
}

function buildVariantsArrayFromRow(row) {
  const out = [];
  const na = String(row?.option_name_a ?? row?.optionNameA ?? "").trim();
  const va = normalizeUniqueChoiceList(normalizeDbTextArray(row?.option_values_a ?? row?.optionValuesA));
  if (na && va.length) out.push({ type: na, choices: va });
  const nb = String(row?.option_name_b ?? row?.optionNameB ?? "").trim();
  const vb = normalizeUniqueChoiceList(normalizeDbTextArray(row?.option_values_b ?? row?.optionValuesB));
  if (nb && vb.length) out.push({ type: nb, choices: vb });
  return out;
}

/** Drop undefined so Supabase JSON does not send stray keys; omitted columns stay omitted. */
function compactOrderPatchForWrite(patch) {
  const out = {};
  if (!patch || typeof patch !== "object") return out;
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Emergency subset if milestone / optional columns are absent in PostgREST schema (unmigrated DB).
 * Keeps transitions working; timeline falls back to `updated_at` on the client.
 */
function minimalOrdersWritePatchFallback(full) {
  const allow = [
    "updated_at",
    "status",
    "quantity",
    "fulfillment_type",
    "cod_goods_cents",
    "cod_delivery_cents",
    /* Omit buyer/seller courier split columns here — they are in ORDER_UPDATE_OPTIONAL_COLUMNS; re-including them
     * caused PostgREST to keep failing after those keys were stripped (schema cache / unmigrated DB). */
    "accepted_courier_assignment_id",
    "accepted_bid_id",
  ];
  const out = {};
  for (const k of allow) {
    if (Object.prototype.hasOwnProperty.call(full, k)) out[k] = full[k];
  }
  return compactOrderPatchForWrite(out);
}

function isOrdersSchemaCacheColumnError(error) {
  const t = postgrestErrorText(error);
  return (
    Boolean(error) &&
    (error.code === "PGRST204" ||
      /schema cache/i.test(t) ||
      ORDERS_MISSING_COLUMN_RE.test(t) ||
      ORDERS_MISSING_COLUMN_RE_DQ.test(t))
  );
}

/**
 * Update a row in `orders`, retrying without keys PostgREST reports as missing (older DBs without milestone columns).
 * Uses UPDATE without chained RETURNING — some setups error on `select('*')` after PATCH if the schema cache lags.
 */
async function updateOrderRowRetryWithoutMissingColumns(id, patch) {
  const original = compactOrderPatchForWrite(patch);
  let attempt = { ...original };

  const runUpdateAndFetch = async (p) => {
    const body = compactOrderPatchForWrite(p);
    const { error: uerr } = await supabaseAdmin.from("orders").update(body).eq("id", id);
    if (uerr) return { data: null, error: uerr };
    const { data: updated, error: rerr } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (rerr) return { data: null, error: rerr };
    return { data: updated, error: null };
  };

  for (let i = 0; i < 32; i++) {
    const { data: updated, error: uerr } = await runUpdateAndFetch(attempt);
    if (!uerr) return { data: updated, error: null };
    const fullMsg = postgrestErrorText(uerr);
    let m = fullMsg.match(ORDERS_MISSING_COLUMN_RE);
    if (!m) m = fullMsg.match(ORDERS_MISSING_COLUMN_RE_DQ);
    if (m && m[1] && Object.prototype.hasOwnProperty.call(attempt, m[1])) {
      const next = { ...attempt };
      delete next[m[1]];
      attempt = next;
      continue;
    }
    if (isOrdersSchemaCacheColumnError(uerr)) {
      let stripped = false;
      for (const col of ORDER_UPDATE_OPTIONAL_COLUMNS) {
        if (Object.prototype.hasOwnProperty.call(attempt, col)) {
          const next = { ...attempt };
          delete next[col];
          attempt = next;
          stripped = true;
          break;
        }
      }
      if (stripped) continue;
      const slim = minimalOrdersWritePatchFallback(original);
      if (Object.keys(slim).length > 0) {
        const r = await runUpdateAndFetch(slim);
        if (!r.error) return r;
      }
      const bare = compactOrderPatchForWrite({
        updated_at: original.updated_at,
        ...(original.status !== undefined ? { status: original.status } : {}),
      });
      if (Object.keys(bare).length > 0) {
        const r2 = await runUpdateAndFetch(bare);
        if (!r2.error) return r2;
      }
    }
    return { data: null, error: uerr };
  }
  return { data: null, error: new Error("orders update exceeded retry limit") };
}

const ALLOWED_LISTING_STATUSES = new Set(["active", "paused", "sold"]);

function isListingsSchemaCacheOrMissingColumnError(error) {
  const msg = String(error?.message || "");
  return (
    error?.code === "PGRST204" ||
    /schema cache/i.test(msg) ||
    /Could not find the '[^']+' column of 'listings'/i.test(msg)
  );
}

/** Optional listing columns omitted when DB schema lags (excluding image_urls — handled in its own retry step). */
const LISTINGS_OPTIONAL_PRODUCT_COLUMNS = [
  "option_name_a",
  "option_values_a",
  "option_name_b",
  "option_values_b",
  "order_type",
  "processing_time",
  "service_meta",
  "sold_count",
  "image_focal_rects",
];
const CART_LISTING_REQUIRED_SELECT =
  "id,seller_id,title,description,image_url,price_cents,quantity,status,fulfillment_modes";
const CART_LISTING_OPTIONAL_COLUMNS = [
  "vertical_id",
  "categories",
  "service_meta",
  "order_type",
  "processing_time",
  "option_name_a",
  "option_values_a",
  "option_name_b",
  "option_values_b",
];
const firstRow = (data) => (Array.isArray(data) && data.length > 0 ? data[0] : null);

/** Last three comma-separated segments of `address`: city, province, postal (Express create format). */
function localeTailFromAddress(address) {
  const parts = String(address || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 3) return { city: "", province: "", postalCode: "" };
  const postalCode = parts[parts.length - 1] || "";
  const province = parts[parts.length - 2] || "";
  const city = parts.slice(0, -2).join(", ") || "";
  return { city, province, postalCode };
}

/** Prefer DB `city` / `province` / `postal_code`; if blank, derive from `address` (works before locale migration). */
function effectiveCommunityLocale(row) {
  const dbCity = String(row.city ?? "").trim();
  const dbProv = String(row.province ?? "").trim();
  const dbPost = String(row.postal_code ?? "").trim();
  if (dbCity || dbProv || dbPost) return { city: dbCity, province: dbProv, postalCode: dbPost };
  return localeTailFromAddress(row.address ?? row.area_description ?? "");
}

const listingRowToApi = (row) => ({
  id: row.id,
  sellerId: row.seller_id,
  title: row.title,
  description: row.description,
  priceCents: row.price_cents,
  quantity: row.quantity,
  soldCount: Math.max(0, Number(row.sold_count) || 0),
  categories: row.categories ?? row.vertical_id,
  verticalId: row.vertical_id,
  subId: row.sub_id,
  fulfillmentModes: row.fulfillment_modes,
  status: row.status,
  cityLabel: row.city_label,
  lat: row.lat,
  lng: row.lng,
  imageUrl: row.image_url,
  imageUrls: dedupeListingImageUrlsOrdered(normalizeDbImageUrls(row.image_urls)).slice(0, LISTING_IMAGE_URLS_CAP),
  imageFocalRects: normalizeDbImageFocalRects(
    row.image_focal_rects,
    dedupeListingImageUrlsOrdered(normalizeDbImageUrls(row.image_urls)).slice(0, LISTING_IMAGE_URLS_CAP).length ||
      (String(row.image_url || "").trim() ? 1 : 0),
  ),
  optionNameA: String(row.option_name_a ?? row.optionNameA ?? "").trim(),
  optionValuesA: normalizeDbTextArray(row.option_values_a ?? row.optionValuesA).map(String),
  optionNameB: String(row.option_name_b ?? row.optionNameB ?? "").trim(),
  optionValuesB: normalizeDbTextArray(row.option_values_b ?? row.optionValuesB).map(String),
  variants: buildVariantsArrayFromRow(row),
  orderType: String(row.order_type ?? row.orderType ?? "in_stock").trim() || "in_stock",
  processingTime: String(row.processing_time ?? row.processingTime ?? "").trim(),
  serviceMeta:
    row.service_meta != null && typeof row.service_meta === "object" && !Array.isArray(row.service_meta)
      ? row.service_meta
      : null,
  communityId: row.community_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function enrichListingsWithSellerProfile(rows) {
  const input = Array.isArray(rows) ? rows : [];
  if (input.length === 0) return [];
  const sellerIds = [...new Set(input.map((r) => String(r?.seller_id || "").trim()).filter(Boolean))];
  let profileById = new Map();
  if (sellerIds.length > 0) {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,username,address,avatar_url")
      .in("id", sellerIds);
    if (!error) {
      profileById = new Map(
        (profiles || []).map((p) => [
          String(p?.id || "").trim(),
          {
            username: String(p?.username || "").trim(),
            address: String(p?.address || "").trim(),
            avatarUrl: String(p?.avatar_url || "").trim(),
          },
        ]),
      );
    }
  }
  return input.map((row) => {
    const base = listingRowToApi(row);
    const seller = profileById.get(String(row?.seller_id || "").trim()) || null;
    return {
      ...base,
      sellerUsername: seller?.username || "",
      sellerAddress: seller?.address || "",
      sellerAvatarUrl: seller?.avatarUrl || "",
    };
  });
}

const buyerReviewRowToApi = (row) => {
  if (!row) return null;
  const legacyRating = row.rating != null ? Number(row.rating) : null;
  const productRating = row.product_rating != null ? Number(row.product_rating) : legacyRating;
  const sellerRating = row.seller_rating != null ? Number(row.seller_rating) : legacyRating;
  const REVIEW_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const readDeadline = (startedAt, fallbackCreatedAt = null) => {
    const startedMs = Number.isFinite(new Date(startedAt).getTime())
      ? new Date(startedAt).getTime()
      : Number.isFinite(new Date(fallbackCreatedAt).getTime())
        ? new Date(fallbackCreatedAt).getTime()
        : NaN;
    if (!Number.isFinite(startedMs)) return null;
    return new Date(startedMs + REVIEW_EDIT_WINDOW_MS).toISOString();
  };
  const productEditableUntil = productRating != null
    ? readDeadline(row.product_rating_started_at, row.created_at)
    : null;
  const sellerEditableUntil = sellerRating != null
    ? readDeadline(row.seller_rating_started_at, row.created_at)
    : null;
  const productCanEdit = productRating != null
    ? Boolean(productEditableUntil && nowMs <= new Date(productEditableUntil).getTime())
    : true;
  const sellerCanEdit = sellerRating != null
    ? Boolean(sellerEditableUntil && nowMs <= new Date(sellerEditableUntil).getTime())
    : true;
  return {
    productRating: Number.isFinite(productRating) ? productRating : null,
    sellerRating: Number.isFinite(sellerRating) ? sellerRating : null,
    productReviewText: String(row.product_review_text ?? row.review_text ?? "").trim() || null,
    sellerReviewText: String(row.seller_review_text ?? row.review_text ?? "").trim() || null,
    productRatingStartedAt: row.product_rating_started_at ?? null,
    sellerRatingStartedAt: row.seller_rating_started_at ?? null,
    productEditableUntil,
    sellerEditableUntil,
    productCanEdit,
    sellerCanEdit,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at,
  };
};

const ALLOWED_COURIER_DELIVERY_REVIEW_TAGS = new Set(["fast", "late", "friendly"]);

const buyerCourierReviewRowToApi = (row) => {
  if (!row) return null;
  const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t).toLowerCase()).filter(Boolean) : [];
  const REVIEW_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;
  const startedMs = Number.isFinite(new Date(row.rating_started_at).getTime())
    ? new Date(row.rating_started_at).getTime()
    : Number.isFinite(new Date(row.created_at).getTime())
      ? new Date(row.created_at).getTime()
      : NaN;
  const editableUntil = Number.isFinite(startedMs) ? new Date(startedMs + REVIEW_EDIT_WINDOW_MS).toISOString() : null;
  const canEdit = row.rating != null ? Boolean(editableUntil && Date.now() <= new Date(editableUntil).getTime()) : true;
  return {
    rating: row.rating,
    tags,
    abuseNote: row.abuse_note != null && String(row.abuse_note).trim() ? String(row.abuse_note).trim() : null,
    abuseReportedAt: row.abuse_reported_at ?? null,
    ratingStartedAt: row.rating_started_at ?? null,
    editableUntil,
    canEdit,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at,
  };
};

/** Snapshot fields from `listings` row (snake_case) for order responses — keeps thumbnails working without extra client fetches. */
function orderListingSnapshotFromDbRow(row) {
  if (!row)
    return {
      listingTitle: null,
      listingImageUrl: "",
      listingImageUrls: [],
      listingCommunityId: null,
      listingVerticalId: null,
      listingCategories: null,
      listingSubId: null,
    };
  const imageUrls = dedupeListingImageUrlsOrdered(normalizeDbImageUrls(row.image_urls)).slice(0, LISTING_IMAGE_URLS_CAP);
  const primary = String(row.image_url || "").trim() || String(imageUrls[0] || "").trim();
  const cid = row.community_id != null ? String(row.community_id).trim() : "";
  /** Match {@link listingRowIsService}: some rows use `categories` when `vertical_id` is unset. */
  const verticalRaw = String(row.vertical_id ?? row.verticalId ?? "").trim();
  const categoriesRaw = String(row.categories ?? "").trim().toLowerCase();
  const vertical =
    verticalRaw.toLowerCase() === "services" || categoriesRaw === "services" ? "services" : verticalRaw || null;
  const sub = String(row.sub_id ?? row.subId ?? "").trim();
  return {
    listingTitle: String(row.title || "").trim() || null,
    listingImageUrl: primary,
    listingImageUrls: imageUrls.length ? imageUrls : primary ? [primary] : [],
    listingCommunityId: cid || null,
    listingVerticalId: vertical,
    listingCategories: row.categories != null && String(row.categories).trim() ? String(row.categories).trim() : null,
    listingSubId: sub || null,
  };
}

/**
 * Order IDs that have at least one accepted `courier_assignments` row (community courier, not seller-only delivery).
 */
async function orderIdsWithAcceptedCommunityCourier(orderIds) {
  const uniq = [...new Set((orderIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  /** @type {Set<string>} */
  const out = new Set();
  if (uniq.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from("courier_assignments")
    .select("order_id")
    .in("order_id", uniq)
    .eq("status", "accepted");
  if (error || !Array.isArray(data)) return out;
  for (const r of data) {
    const oid = String(r?.order_id || "").trim();
    if (oid) out.add(oid);
  }
  return out;
}

function computeBuyerMayRateSeller(order) {
  const oid = String(order.id || "").trim();
  const sellerId = String(order.seller_id || "").trim();
  const buyerId = String(order.buyer_id || "").trim();
  return Boolean(oid && sellerId && buyerId);
}

/**
 * For buyer order lists: courier id per page order (for eligibility flags).
 * @returns {Promise<{ courierIdByOrderId: Map<string, string> }>}
 */
async function buyerCourierMapsForList(pageOrderIds) {
  const courierIdByOrderId = new Map();
  const pageIds = (pageOrderIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (pageIds.length > 0) {
    const { data: pageCas } = await supabaseAdmin
      .from("courier_assignments")
      .select("order_id, courier_id")
      .in("order_id", pageIds)
      .eq("status", "accepted");
    for (const ca of pageCas || []) {
      const oid = String(ca.order_id || "").trim();
      const cid = String(ca.courier_id || "").trim();
      if (oid && cid && !courierIdByOrderId.has(oid)) courierIdByOrderId.set(oid, cid);
    }
  }

  return { courierIdByOrderId };
}

/** Source of truth for buyer review section eligibility on an order. */
function resolveBuyerReviewEligibilityForOrder(order, options = {}) {
  const hasCommunityCourierDelivery = Boolean(options.hasCommunityCourierDelivery);
  const sellerId = String(order?.seller_id || order?.sellerId || "").trim();
  const courierId = String(options.courierId || "").trim();
  const buyerMayRateSeller = computeBuyerMayRateSeller(order);
  const buyerMayRateCourier = Boolean(
    hasCommunityCourierDelivery && courierId && sellerId && courierId !== sellerId,
  );
  return { buyerMayRateSeller, buyerMayRateCourier, hasCommunityCourierDelivery };
}

/** Eligibility flags after a review mutation (same rules as list). */
async function buyerRatingEligibilityExtras(order, hasCommunityCourierDelivery) {
  let courierId = "";
  if (hasCommunityCourierDelivery) {
    const { assignment } = await resolveAcceptedCourierAssignmentForReview(order);
    courierId = assignment?.courier_id != null ? String(assignment.courier_id).trim() : "";
  }
  return resolveBuyerReviewEligibilityForOrder(order, { hasCommunityCourierDelivery, courierId });
}

const orderRowToApi = (row, reviewRow = null, listingMeta = null, courierReviewRow = null, extras = {}) => {
  const courierAssignmentId = row.accepted_courier_assignment_id ?? row.accepted_bid_id ?? null;
  const hasCommunityCourierDelivery =
    extras.hasCommunityCourierDelivery !== undefined
      ? Boolean(extras.hasCommunityCourierDelivery)
      : Boolean(courierAssignmentId);
  return {
  id: row.id,
  listingId: row.listing_id,
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  quantity: row.quantity,
  fulfillmentType: row.fulfillment_type,
  status: row.status,
  codGoodsCents: row.cod_goods_cents,
  codDeliveryCents: row.cod_delivery_cents,
  buyerCourierContributionCents: Math.max(0, Math.floor(Number(row.buyer_courier_contribution_cents) || 0)),
  sellerCourierContributionCents: Math.max(0, Math.floor(Number(row.seller_courier_contribution_cents) || 0)),
  acceptedCourierAssignmentId: courierAssignmentId,
  /** @deprecated Use acceptedCourierAssignmentId */
  acceptedBidId: courierAssignmentId,
  /** True when an accepted `courier_assignments` row exists — buyer may rate the community courier (not seller self-delivery). */
  hasCommunityCourierDelivery,
  /**
   * Buyer context only (from list orders / review responses): whether seller / courier rating UI applies.
   * Seller and courier rating flags indicate whether each section applies on this order.
   * Product/seller can be rated per completed purchase; courier applies when a separate accepted community courier exists.
   */
  buyerMayRateSeller: Object.prototype.hasOwnProperty.call(extras, "buyerMayRateSeller")
    ? Boolean(extras.buyerMayRateSeller)
    : undefined,
  buyerMayRateCourier: Object.prototype.hasOwnProperty.call(extras, "buyerMayRateCourier")
    ? Boolean(extras.buyerMayRateCourier)
    : undefined,
  comment: String(row.buyer_comment ?? "").trim(),
  variantSignature: String(row.variant_signature ?? "").trim(),
  buyerReceiptAcknowledgedAt: row.buyer_receipt_acknowledged_at ?? null,
  buyerReview: buyerReviewRowToApi(reviewRow),
  buyerCourierReview: buyerCourierReviewRowToApi(courierReviewRow),
  processingEnteredAt: row.processing_entered_at ?? null,
  completedAt: row.completed_at ?? null,
  cancelledAt: row.cancelled_at ?? null,
  cancelledByRole: row.cancelled_by_role ?? null,
  cancellationReason: row.cancellation_reason ?? null,
  cancellationNote:
    row.cancellation_note != null && String(row.cancellation_note).trim()
      ? String(row.cancellation_note).trim()
      : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(() => {
    const slot = effectiveServiceSlotFromOrderRow(row);
    return {
      serviceBookingDate: slot?.date ?? null,
      serviceBookingTime: slot?.time ?? null,
    };
  })(),
  ...orderListingSnapshotFromDbRow(listingMeta),
};
};

/** COD delivery fee is agreed offline; `courier_assignments` row keeps a minimal positive amount for DB constraints. */
const COMMUNITY_DELIVERY_PLACEHOLDER_CENTS = 1;
const ALLOWED_COURIER_OPTIONAL_TAGS = new Set(["eco", "bike", "fast", "helping"]);

/** Achievement-style badges derived from completed runs + profile hints (not self-serve tags alone). */
function deriveCourierAchievementBadges({ completedDeliveries, optionalTags, modes }) {
  const tags = new Set((optionalTags || []).map((t) => String(t).toLowerCase()));
  const modesSet = new Set((modes || []).map((m) => String(m).toLowerCase()));
  const n = Math.max(0, Number(completedDeliveries) || 0);
  /** @type {{ id: string, label: string }[]} */
  const badges = [];
  if (n >= 1) badges.push({ id: "first_run", label: "First run" });
  if (n >= 5) badges.push({ id: "regular", label: "Regular" });
  if (n >= 10) badges.push({ id: "trusted_carrier", label: "Trusted carrier" });
  if (tags.has("eco") && n >= 3) badges.push({ id: "eco_hero", label: "Eco hero" });
  if (modesSet.has("bike") && n >= 3) badges.push({ id: "bike_master", label: "Bike master" });
  if (tags.has("helping") && n >= 2) badges.push({ id: "neighbor_helper", label: "Neighbor helper" });
  return badges;
}

/** Count completed orders per courier where their assignment was accepted. */
async function countCompletedDeliveriesForCourierIds(courierIds) {
  const ids = [...new Set((courierIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  /** @type {Map<string, number>} */
  const counts = new Map(ids.map((id) => [id, 0]));
  if (ids.length === 0) return counts;
  const { data: bids, error: berr } = await supabaseAdmin
    .from("courier_assignments")
    .select("courier_id, order_id")
    .in("courier_id", ids)
    .eq("status", "accepted");
  if (berr || !bids?.length) return counts;
  const orderIds = [...new Set(bids.map((b) => String(b.order_id || "").trim()).filter(Boolean))];
  if (orderIds.length === 0) return counts;
  const { data: orders, error: oerr } = await supabaseAdmin.from("orders").select("id, status").in("id", orderIds);
  if (oerr || !orders?.length) return counts;
  const completed = new Set(
    (orders || []).filter((o) => String(o.status || "").toLowerCase() === "completed").map((o) => String(o.id)),
  );
  for (const b of bids) {
    const oid = String(b.order_id || "");
    if (!completed.has(oid)) continue;
    const cid = String(b.courier_id || "");
    counts.set(cid, (counts.get(cid) || 0) + 1);
  }
  return counts;
}

async function resolveOrderCommunityId(order) {
  if (!order?.listing_id) return null;
  const { data: listing, error } = await supabaseAdmin
    .from("listings")
    .select("community_id, seller_id")
    .eq("id", order.listing_id)
    .maybeSingle();
  if (error || !listing) return null;
  if (listing.community_id) return String(listing.community_id);
  if (!listing.seller_id) return null;
  const { data: prof } = await supabaseAdmin.from("profiles").select("community_id").eq("id", listing.seller_id).maybeSingle();
  return prof?.community_id ? String(prof.community_id) : null;
}

function utcDayStartIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

/** Monday 00:00 UTC for the ISO week containing `d`. */
function utcWeekStartMondayIso(d = new Date()) {
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysFromMonday, 0, 0, 0, 0)).toISOString();
}

function engagementThresholds() {
  const r = parseFloat(String(process.env.COURIER_TOP_MIN_AVG_RATING ?? "4").trim());
  const minAvgRating = Number.isFinite(r) ? Math.min(5, Math.max(1, r)) : 4;
  const minRev = parseInt(String(process.env.COURIER_TOP_MIN_REVIEWS ?? "1").trim(), 10);
  const fastSamples = parseInt(String(process.env.COURIER_FASTEST_MIN_DELIVERIES ?? "2").trim(), 10);
  const lim = parseInt(String(process.env.COURIER_LEADERBOARD_LIMIT ?? "15").trim(), 10);
  return {
    minAvgRating,
    minReviews: Number.isFinite(minRev) ? Math.max(1, minRev) : 1,
    fastestMinDeliveries: Number.isFinite(fastSamples) ? Math.max(2, fastSamples) : 2,
    leaderboardLimit: Number.isFinite(lim) ? Math.min(50, Math.max(5, lim)) : 15,
  };
}

/**
 * Effective listing community (listing.community_id else seller profile.community_id) — matches open-delivery matching.
 * @param {{ id?: string, listing_id?: string }[]} orderRows
 */
async function mapOrderIdsToCommunityIds(orderRows) {
  const rows = Array.isArray(orderRows) ? orderRows : [];
  if (rows.length === 0) return new Map();
  const listingIds = [...new Set(rows.map((r) => String(r?.listing_id || "").trim()).filter(Boolean))];
  /** @type {Map<string, string | null>} */
  const out = new Map();
  if (listingIds.length === 0) return out;
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select("id, community_id, seller_id")
    .in("id", listingIds);
  const listingRows = listings || [];
  const sellersNeedingCommunity = listingRows.filter((L) => !L.community_id && L.seller_id).map((L) => L.seller_id);
  let sellerCommunityById = new Map();
  if (sellersNeedingCommunity.length > 0) {
    const { data: sellerProfs } = await supabaseAdmin
      .from("profiles")
      .select("id, community_id")
      .in("id", [...new Set(sellersNeedingCommunity)]);
    sellerCommunityById = new Map(
      (sellerProfs || []).map((p) => [String(p.id), p.community_id ? String(p.community_id) : null]),
    );
  }
  const metaByListing = new Map(listingRows.map((L) => [String(L.id), L]));
  for (const r of rows) {
    const oid = String(r?.id || "").trim();
    const lid = String(r?.listing_id || "").trim();
    if (!oid || !lid) continue;
    const L = metaByListing.get(lid);
    if (!L) {
      out.set(oid, null);
      continue;
    }
    if (L.community_id) out.set(oid, String(L.community_id));
    else {
      const sid = L.seller_id ? String(L.seller_id) : "";
      out.set(oid, sid ? sellerCommunityById.get(sid) || null : null);
    }
  }
  return out;
}

async function fetchListingMetaForOrder(order) {
  if (!order?.listing_id) return null;
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("id, title, image_url, image_urls, community_id, vertical_id, categories, sub_id")
    .eq("id", order.listing_id)
    .maybeSingle();
  return listing || null;
}

async function setProfileCourierStatus(userId, status) {
  if (!userId || !status) return;
  const { error } = await supabaseAdmin.from("profiles").update({ courier_status: status }).eq("id", userId);
  if (error && process.env.NODE_ENV !== "production") {
    if (error.code === "PGRST204" || /courier_status/i.test(String(error.message || ""))) {
      console.warn("[courier] courier_status column missing; run migrations.");
    }
  }
}

async function clearCourierBusyForOrderRow(orderRow) {
  const assignmentId = orderRow?.accepted_courier_assignment_id ?? orderRow?.accepted_bid_id;
  if (!assignmentId) return;
  const { data: bid } = await supabaseAdmin
    .from("courier_assignments")
    .select("courier_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (bid?.courier_id) {
    await setProfileCourierStatus(bid.courier_id, "available");
  }
}

async function markCourierBusy(courierId) {
  await setProfileCourierStatus(courierId, "busy");
}

const COURIER_TRANSPORT_MODES = ["walk", "run", "bike", "others"];

/** True when this courier has an accepted assignment on an order still in the delivery pipeline (not completed/cancelled). */
async function courierHasInProgressDelivery(courierId) {
  const cid = String(courierId || "").trim();
  if (!cid) return false;
  const { data: assignments, error: aerr } = await supabaseAdmin
    .from("courier_assignments")
    .select("order_id")
    .eq("courier_id", cid)
    .eq("status", "accepted");
  if (aerr || !assignments?.length) return false;
  const orderIds = [...new Set(assignments.map((a) => String(a.order_id || "")).filter(Boolean))];
  if (orderIds.length === 0) return false;
  const { data: orders, error: oerr } = await supabaseAdmin
    .from("orders")
    .select("id")
    .in("id", orderIds)
    .in("status", ["courier_assigned", "out_for_delivery"]);
  if (oerr) return false;
  return (orders || []).length > 0;
}

/**
 * Picks `courier_assignments.mode`: explicit request wins if allowed by profile; else bike → run → walk.
 * @param {string[]} profileModes normalized list from `profiles.courier_modes`
 * @param {string} [requestedRaw] optional mode from claim/assign body
 */
function resolveCourierAssignmentMode(profileModes, requestedRaw) {
  const modes = normalizeDbTextArray(profileModes);
  const req = requestedRaw != null ? String(requestedRaw).trim().toLowerCase() : "";
  if (req) {
    if (!COURIER_TRANSPORT_MODES.includes(req)) {
      throw new AppError(400, "mode must be walk, run, bike, or others.");
    }
    if (modes.length > 0 && !modes.includes(req)) {
      throw new AppError(400, "Choose a transport mode enabled on your courier profile.");
    }
    return req;
  }
  if (modes.includes("bike")) return "bike";
  if (modes.includes("run")) return "run";
  if (modes.includes("walk")) return "walk";
  if (modes.includes("others")) return "others";
  return "walk";
}

/**
 * Win `seller_accepted` → `courier_assigned` for an existing `courier_assignments` row (claim or invitation accept).
 */
async function atomicAcceptCourierAssignment(order, bidId, courierId) {
  const orderId = order.id;
  const bidTs = new Date().toISOString();
  const orderPatch = compactOrderPatchForWrite({
    status: "courier_assigned",
    accepted_courier_assignment_id: bidId,
    updated_at: bidTs,
    ...(!order.processing_entered_at ? { processing_entered_at: bidTs } : {}),
  });

  const { error: uerr } = await supabaseAdmin.from("orders").update(orderPatch).eq("id", orderId).eq("status", "seller_accepted");
  if (uerr) throw new AppError(500, uerr.message);

  const { data: updatedOrder } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!updatedOrder || updatedOrder.status !== "courier_assigned") {
    await supabaseAdmin.from("courier_assignments").update({ status: "rejected" }).eq("id", bidId);
    throw new AppError(409, "Someone else just accepted this delivery. Try another order.");
  }

  await supabaseAdmin.from("courier_assignments").update({ status: "rejected" }).eq("order_id", orderId).neq("id", bidId);
  await supabaseAdmin.from("courier_assignments").update({ status: "accepted" }).eq("id", bidId);
  await markCourierBusy(courierId);

  const oid = String(updatedOrder.id);
  await notifyUserOrderEvent({
    recipientUserId: updatedOrder.buyer_id,
    actorUserId: courierId,
    orderId: oid,
    recipientRole: "buyer",
    title: "Courier assigned",
    body: "A courier accepted your delivery.",
    orderStatusForTab: updatedOrder.status,
  });
  await notifyUserOrderEvent({
    recipientUserId: updatedOrder.seller_id,
    actorUserId: courierId,
    orderId: oid,
    recipientRole: "seller",
    title: "Courier assigned",
    body: "A courier accepted the delivery for this order.",
    orderStatusForTab: updatedOrder.status,
  });

  const listingMeta = await fetchListingMetaForOrder(updatedOrder);
  return orderRowToApi(updatedOrder, null, listingMeta);
}

/**
 * Merge buyer/seller suggestion flags for the same pending courier assignment (UNIQUE per order+courier).
 * @param {{ invited_by_buyer?: boolean, invited_by_seller?: boolean } | null | undefined} existing
 * @param {'buyer' | 'seller' | 'courier'} role
 */
function mergeCourierInvitationInviterFlags(existing, role) {
  const prevB = Boolean(existing?.invited_by_buyer);
  const prevS = Boolean(existing?.invited_by_seller);
  return {
    invited_by_buyer: prevB || role === "buyer",
    invited_by_seller: prevS || role === "seller",
  };
}

/**
 * Community delivery: record courier on `courier_assignments`, optionally only as an invitation (buyer/seller suggest).
 * Courier self-claim finalizes immediately; buyer/seller assign leaves order on `seller_accepted` until the courier accepts.
 *
 * @param {{ mode?: string, invitationOnly?: boolean }} [options]
 */
async function assignCourierToOpenDeliveryOrder(orderId, courierId, actorUserId, role, options = {}) {
  const invitationOnly = Boolean(options.invitationOnly);

  const { data: order, error: oerr } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (oerr) throw new AppError(500, oerr.message);
  if (!order) throw new AppError(404, "Order not found.");
  if (order.fulfillment_type !== "delivery") throw new AppError(400, "Not a delivery order.");
  if (order.buyer_id === courierId || order.seller_id === courierId) {
    throw new AppError(400, "Buyer or seller cannot act as courier on this order.");
  }

  const existingAssignmentId = order.accepted_courier_assignment_id ?? order.accepted_bid_id;
  if (order.status === "courier_assigned" && existingAssignmentId) {
    const { data: acceptedBid } = await supabaseAdmin
      .from("courier_assignments")
      .select("courier_id")
      .eq("id", existingAssignmentId)
      .maybeSingle();
    if (acceptedBid?.courier_id === courierId) {
      const listingMeta = await fetchListingMetaForOrder(order);
      return orderRowToApi(order, null, listingMeta);
    }
    throw new AppError(409, "This order already has a courier.");
  }
  if (order.status !== "seller_accepted") throw new AppError(400, "This order is not open for courier assignment.");

  const isSeller = order.seller_id === actorUserId;
  const isBuyer = order.buyer_id === actorUserId;
  const isCourierSelf = courierId === actorUserId;
  if (role === "seller" && !isSeller) throw new AppError(403, "Only the seller can assign a courier.");
  if (role === "buyer" && !isBuyer) throw new AppError(403, "Only the buyer can assign a courier on this order.");
  if (role === "courier" && !isCourierSelf) throw new AppError(403, "You can only claim deliveries for yourself.");

  const communityId = await resolveOrderCommunityId(order);
  if (!communityId) {
    throw new AppError(
      400,
      "This listing is not linked to a community. Attach the listing to a neighborhood community to use community couriers.",
    );
  }

  const { data: courierProfile, error: perr } = await supabaseAdmin
    .from("profiles")
    .select("community_id, courier_status")
    .eq("id", courierId)
    .maybeSingle();
  if (perr) throw new AppError(500, perr.message);
  if (!courierProfile || String(courierProfile.community_id || "") !== communityId) {
    throw new AppError(403, "Courier must belong to the same community as this order.");
  }
  const cs = String(courierProfile.courier_status || "offline");
  if (cs === "busy") throw new AppError(400, "That courier is busy with another delivery.");
  if (cs !== "available" && cs !== "active") throw new AppError(400, "Courier must be Available or Active to deliver.");

  const { data: modeRow } = await supabaseAdmin.from("profiles").select("courier_modes").eq("id", courierId).maybeSingle();
  const modes = normalizeDbTextArray(modeRow?.courier_modes);
  const mode = resolveCourierAssignmentMode(modes, options.mode);

  if (invitationOnly) {
    await supabaseAdmin
      .from("courier_assignments")
      .update({ status: "superseded" })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .neq("courier_id", courierId);
  }

  let courierAssignmentInviterColumns = true;
  let { data: existingPair, error: existingPairErr } = await supabaseAdmin
    .from("courier_assignments")
    .select("id, status, invited_by_buyer, invited_by_seller")
    .eq("order_id", orderId)
    .eq("courier_id", courierId)
    .maybeSingle();
  if (existingPairErr && isMissingCourierAssignmentInviterColumnsError(existingPairErr)) {
    courierAssignmentInviterColumns = false;
    const fallback = await supabaseAdmin
      .from("courier_assignments")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("courier_id", courierId)
      .maybeSingle();
    if (fallback.error) throw new AppError(500, fallback.error.message);
    existingPair = fallback.data;
  } else if (existingPairErr) {
    throw new AppError(500, existingPairErr.message);
  }

  let bidId = null;

  if (existingPair) {
    const st = String(existingPair.status || "").toLowerCase();
    if (st === "accepted") {
      throw new AppError(409, "This order already has a courier.");
    }
    if (invitationOnly) {
      if (st === "pending") {
        const invFlags = courierAssignmentInviterColumns ? mergeCourierInvitationInviterFlags(existingPair, role) : {};
        const { error: upPen } = await supabaseAdmin
          .from("courier_assignments")
          .update({ mode, ...invFlags })
          .eq("id", existingPair.id);
        if (upPen && isMissingCourierAssignmentInviterColumnsError(upPen)) {
          courierAssignmentInviterColumns = false;
          const { error: upPen2 } = await supabaseAdmin.from("courier_assignments").update({ mode }).eq("id", existingPair.id);
          if (upPen2) throw new AppError(400, upPen2.message);
        } else if (upPen) {
          throw new AppError(400, upPen.message);
        }
        bidId = existingPair.id;
      } else if (st === "rejected" || st === "superseded") {
        const invFlags = courierAssignmentInviterColumns ? mergeCourierInvitationInviterFlags(existingPair, role) : {};
        let reinvErr = null;
        ({ error: reinvErr } = await supabaseAdmin
          .from("courier_assignments")
          .update({
            mode,
            status: "pending",
            amount_cents: COMMUNITY_DELIVERY_PLACEHOLDER_CENTS,
            ...invFlags,
          })
          .eq("id", existingPair.id));
        if (reinvErr && isMissingCourierAssignmentInviterColumnsError(reinvErr)) {
          courierAssignmentInviterColumns = false;
          ({ error: reinvErr } = await supabaseAdmin
            .from("courier_assignments")
            .update({
              mode,
              status: "pending",
              amount_cents: COMMUNITY_DELIVERY_PLACEHOLDER_CENTS,
            })
            .eq("id", existingPair.id));
        }
        if (reinvErr) throw new AppError(400, reinvErr.message);
        bidId = existingPair.id;
      } else {
        throw new AppError(400, "Cannot suggest this courier for this order right now.");
      }
    } else if (st === "pending") {
      bidId = existingPair.id;
    } else if (st === "rejected" || st === "superseded") {
      const { error: reclaimErr } = await supabaseAdmin
        .from("courier_assignments")
        .update({
          mode,
          status: "pending",
          amount_cents: COMMUNITY_DELIVERY_PLACEHOLDER_CENTS,
        })
        .eq("id", existingPair.id);
      if (reclaimErr) throw new AppError(400, reclaimErr.message);
      bidId = existingPair.id;
    } else {
      throw new AppError(409, "Could not claim this delivery.");
    }
  }

  if (!bidId) {
    const buildInsertPayload = (withInviterCols) => ({
      order_id: orderId,
      courier_id: courierId,
      amount_cents: COMMUNITY_DELIVERY_PLACEHOLDER_CENTS,
      eta_minutes: null,
      mode,
      status: "pending",
      ...(invitationOnly && withInviterCols ? mergeCourierInvitationInviterFlags(null, role) : {}),
    });
    let { data: inserted, error: ierr } = await supabaseAdmin
      .from("courier_assignments")
      .insert(buildInsertPayload(courierAssignmentInviterColumns))
      .select("id")
      .single();
    if (ierr && isMissingCourierAssignmentInviterColumnsError(ierr)) {
      courierAssignmentInviterColumns = false;
      ({ data: inserted, error: ierr } = await supabaseAdmin
        .from("courier_assignments")
        .insert(buildInsertPayload(false))
        .select("id")
        .single());
    }

    if (ierr?.code === "23505") {
      let { data: race, error: raceErr } = await supabaseAdmin
        .from("courier_assignments")
        .select("id, status, invited_by_buyer, invited_by_seller")
        .eq("order_id", orderId)
        .eq("courier_id", courierId)
        .maybeSingle();
      if (raceErr && isMissingCourierAssignmentInviterColumnsError(raceErr)) {
        courierAssignmentInviterColumns = false;
        ({ data: race, error: raceErr } = await supabaseAdmin
          .from("courier_assignments")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("courier_id", courierId)
          .maybeSingle());
      }
      if (raceErr) throw new AppError(500, raceErr.message);
      const rst = String(race?.status || "").toLowerCase();
      if (race?.id && rst === "pending") {
        bidId = race.id;
        if (invitationOnly) {
          const invFlags = courierAssignmentInviterColumns ? mergeCourierInvitationInviterFlags(race, role) : {};
          const { error: upRace } = await supabaseAdmin
            .from("courier_assignments")
            .update({ mode, ...invFlags })
            .eq("id", bidId);
          if (upRace && isMissingCourierAssignmentInviterColumnsError(upRace)) {
            courierAssignmentInviterColumns = false;
            const { error: upRace2 } = await supabaseAdmin.from("courier_assignments").update({ mode }).eq("id", bidId);
            if (upRace2) throw new AppError(400, upRace2.message);
          } else if (upRace) {
            throw new AppError(400, upRace.message);
          }
        }
      } else {
        throw new AppError(409, "Could not claim this delivery.");
      }
    } else if (ierr) {
      throw new AppError(400, ierr.message);
    } else {
      bidId = inserted.id;
    }
  }

  if (invitationOnly) {
    const { data: freshOrder } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
    await notifyCourierInvitation({
      courierUserId: courierId,
      actorUserId,
      orderId: String(orderId),
      title: "Delivery invitation",
      body: "You were invited to deliver an order in your community.",
    });
    const listingMeta = await fetchListingMetaForOrder(freshOrder);
    return orderRowToApi(freshOrder, null, listingMeta);
  }

  return atomicAcceptCourierAssignment(order, bidId, courierId);
}

const communityRowToApi = (row, memberCount) => {
  const address = row.address ?? row.area_description ?? "";
  const imageUrl = row.image_url ?? row.cover_image_url ?? "";
  const googleUrl = row.google_url ?? "";
  const { city, province, postalCode } = effectiveCommunityLocale(row);
  const n = memberCount == null ? 0 : Number(memberCount);
  return {
    id: row.id,
    name: row.name,
    address,
    city,
    province,
    postalCode,
    googleUrl,
    imageUrl,
    memberCount: Number.isFinite(n) && n >= 0 ? n : 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/** Members are users whose profile `community_id` matches the community UUID. Uses grouped SQL via RPC for scale. */
async function loadProfileMemberCountsByCommunity() {
  const { data, error } = await supabaseAdmin.rpc("community_member_counts");
  const counts = new Map();
  if (!error) {
    for (const row of data || []) {
      const communityId = String(row?.community_id || "").trim();
      const memberCount = Number(row?.member_count);
      if (!communityId || !Number.isFinite(memberCount)) continue;
      counts.set(communityId, Math.max(0, memberCount));
    }
  }

  // Backward compatibility: include profiles that still have only text `community`
  // and no `community_id` yet. This prevents undercounting during migration.
  try {
    const [{ data: communityRows, error: communitiesError }, { data: profileRows, error: profilesError }] = await Promise.all([
      supabaseAdmin.from("communities").select("id,name"),
      supabaseAdmin.from("profiles").select("community,community_id"),
    ]);
    if (communitiesError || profilesError) return counts;

    const communityIdByName = new Map();
    for (const row of communityRows || []) {
      const id = String(row?.id || "").trim();
      const key = String(row?.name || "").trim().toLowerCase();
      if (!id || !key || communityIdByName.has(key)) continue;
      communityIdByName.set(key, id);
    }

    for (const row of profileRows || []) {
      if (row?.community_id) continue;
      const key = String(row?.community || "").trim().toLowerCase();
      if (!key) continue;
      const resolvedCommunityId = communityIdByName.get(key);
      if (!resolvedCommunityId) continue;
      counts.set(resolvedCommunityId, (counts.get(resolvedCommunityId) ?? 0) + 1);
    }
  } catch {
    // Keep primary RPC counts even if fallback merge fails.
  }
  return counts;
}

/** Count distinct active listing sellers per community. */
async function loadActiveSellerCountsByCommunity() {
  const { data, error } = await supabaseAdmin.from("listings").select("community_id, seller_id").eq("status", "active");
  if (error) return new Map();
  const buckets = new Map();
  for (const row of data || []) {
    const communityId = String(row?.community_id || "");
    const sellerId = String(row?.seller_id || "");
    if (!communityId || !sellerId) continue;
    if (!buckets.has(communityId)) buckets.set(communityId, new Set());
    buckets.get(communityId).add(sellerId);
  }
  const counts = new Map();
  for (const [communityId, sellers] of buckets.entries()) {
    counts.set(communityId, sellers.size);
  }
  return counts;
}

/** Public-safe fields for the community landing page (no owner id). */
const communityPublicToApi = (row, memberCount) => {
  const loc = effectiveCommunityLocale(row);
  const n = memberCount == null ? 0 : Number(memberCount);
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? row.area_description ?? "",
    city: loc.city,
    province: loc.province,
    postalCode: loc.postalCode,
    googleUrl: row.google_url ?? "",
    imageUrl: row.image_url ?? row.cover_image_url ?? "",
    memberCount: Number.isFinite(n) && n >= 0 ? n : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const DEFAULT_LISTINGS_LIMIT = 24;
const MAX_LISTINGS_LIMIT = 60;
const DEFAULT_ORDERS_LIMIT = 40;
const MAX_ORDERS_LIMIT = 100;

function parsePositiveInt(value, fallback, maxCap) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const whole = Math.floor(n);
  if (whole < 1) return fallback;
  return Math.min(maxCap, whole);
}

export const listListings = async (req, res, next) => {
  try {
    const {
      categories,
      verticalId,
      subId,
      communityId,
      lat,
      lng,
      radiusKm,
      q: textQuery,
      limit,
      offset,
      sellerId: sellerIdQuery,
      includeOwn,
    } = req.query;
    const pageLimit = parsePositiveInt(limit, DEFAULT_LISTINGS_LIMIT, MAX_LISTINGS_LIMIT);
    const pageOffset = Math.max(0, Math.floor(Number(offset) || 0));
    let q = supabaseAdmin
      .from("listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);
    const sellerFilter = String(sellerIdQuery || "").trim();
    if (sellerFilter) q = q.eq("seller_id", sellerFilter);
    const categoryFilter = String(categories || verticalId || "").trim();
    if (categoryFilter) q = q.eq("vertical_id", categoryFilter);
    if (subId && subId !== "all") q = q.eq("sub_id", String(subId));
    if (communityId) q = q.eq("community_id", String(communityId));
    const includeOwnListings =
      String(includeOwn || "").trim().toLowerCase() === "true" || String(includeOwn || "").trim() === "1";
    if (!sellerFilter && req.user?.id && !includeOwnListings) {
      q = q.neq("seller_id", req.user.id);
    }
    const search = String(textQuery || "").trim();
    if (search) {
      const escaped = search.replace(/[%_,]/g, "\\$&");
      q = q.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }
    const latN = lat != null ? Number(lat) : null;
    const lngN = lng != null ? Number(lng) : null;
    const r = radiusKm != null ? Number(radiusKm) : null;
    if (latN != null && lngN != null && r != null && Number.isFinite(r) && r > 0) {
      const latDelta = r / 111.32;
      const safeLatCos = Math.max(0.01, Math.abs(Math.cos((latN * Math.PI) / 180)));
      const lngDelta = r / (111.32 * safeLatCos);
      q = q
        .gte("lat", latN - latDelta)
        .lte("lat", latN + latDelta)
        .gte("lng", lngN - lngDelta)
        .lte("lng", lngN + lngDelta);
    }
    const { data, error } = await q;
    if (error?.code === "PGRST205") return res.json({ listings: [] });
    if (error) throw new AppError(500, error.message);
    const rows = data || [];
    let listings = await enrichListingsWithSellerProfile(rows);
    const listingIdsForRatings = listings.map((l) => String(l?.id || "").trim()).filter(Boolean);
    if (listingIdsForRatings.length > 0) {
      const listingRatingMap = await aggregateListingOrderRatingStatsByListingId(listingIdsForRatings);
      listings = mergeListingOrderReviewStatsIntoListings(listings, listingRatingMap);
    }
    const payload = {
      listings,
      page: {
        limit: pageLimit,
        offset: pageOffset,
        returned: listings.length,
        hasMore: listings.length === pageLimit,
      },
    };
    if (sellerFilter) {
      const ratingMap = await aggregateSellerOrderRatingStatsBySellerId([sellerFilter]);
      const rs = ratingMap.get(sellerFilter) || { sellerAvgRating: null, sellerReviewCount: 0 };
      payload.sellerAvgRating = rs.sellerAvgRating;
      payload.sellerReviewCount = rs.sellerReviewCount;
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

/** GET — anonymous landing hero: totals from listings, profiles, communities. */
export const getPublicMarketplaceStats = async (_req, res, next) => {
  try {
    const countExact = (table) =>
      supabaseAdmin.from(table).select("*", { count: "exact", head: true });

    const [listingsRes, profilesRes, communitiesRes] = await Promise.all([
      supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
      countExact("profiles"),
      countExact("communities"),
    ]);

    const countOrZero = (result) => {
      if (result.error?.code === "PGRST205") return 0;
      if (result.error) throw new AppError(500, result.error.message);
      return Number(result.count) || 0;
    };

    res.json({
      listingsCount: countOrZero(listingsRes),
      accountsCount: countOrZero(profilesRes),
      communitiesCount: countOrZero(communitiesRes),
    });
  } catch (e) {
    next(e);
  }
};

/** GET — which service slots are already held (non-completed / non-cancelled orders) for a listing. */
export const getListingServiceBookedSlots = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: listing, error: lerr } = await supabaseAdmin
      .from("listings")
      .select("id, status, vertical_id, categories, sub_id, seller_id")
      .eq("id", id)
      .maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing) throw new AppError(404, "Listing not found.");
    if (!listingRowIsService(listing)) throw new AppError(400, "Not a service listing.");
    if (listing.status !== "active" && listing.seller_id !== req.user?.id) throw new AppError(404, "Listing not found.");
    const bookedSlots = await listHeldServiceSlotsForListing(supabaseAdmin, id);
    res.json({ bookedSlots });
  } catch (e) {
    next(e);
  }
};

export const getListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: rows, error } = await supabaseAdmin.from("listings").select("*").eq("id", id).limit(1);
    const data = firstRow(rows);
    if (error?.code === "PGRST205") throw new AppError(404, "Listing not found.");
    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, "Listing not found.");
    if (data.status !== "active" && data.seller_id !== req.user?.id) throw new AppError(404, "Listing not found.");
    let listingOut = (await enrichListingsWithSellerProfile([data]))[0] || listingRowToApi(data);
    const lid = String(listingOut?.id || data?.id || "").trim();
    if (lid) {
      const listingRatingMap = await aggregateListingOrderRatingStatsByListingId([lid]);
      [listingOut] = mergeListingOrderReviewStatsIntoListings([listingOut], listingRatingMap);
    }
    res.json({ listing: listingOut });
  } catch (e) {
    next(e);
  }
};

/** POST multipart field `images` (1–6 files) → Supabase Storage; returns public URLs in order. */
export const uploadListingImages = async (req, res, next) => {
  try {
    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
      throw new AppError(400, "Add at least one image file (use field name images).");
    }
    if (files.length > 6) throw new AppError(400, "Too many images (max 6).");

    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("first_name,middle_name,last_name,username")
      .eq("id", req.user.id)
      .limit(1);
    const profile = Array.isArray(profRows) && profRows[0] ? profRows[0] : null;
    let displayName = displayNameForStoragePath(profile, null);
    if (!displayName) {
      const { data: authLookup, error: authLookupErr } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
      if (!authLookupErr && authLookup?.user) displayName = displayNameForStoragePath(null, authLookup.user);
    }

    const urls = [];
    for (const file of files) {
      urls.push(await uploadListingImage(file.buffer, file.mimetype, req.user.id, displayName));
    }
    res.json({ urls });
  } catch (e) {
    next(e);
  }
};

export const createListing = async (req, res, next) => {
  try {
    const categoryId = String(req.body.categories || req.body.verticalId || "").trim();
    if (!categoryId) throw new AppError(400, "Categories is required.");
    const modes = Array.isArray(req.body.fulfillmentModes) && req.body.fulfillmentModes.length
      ? req.body.fulfillmentModes.map(String)
      : ["pickup", "delivery"];
    const rawImageUrls = Array.isArray(req.body.imageUrls)
      ? req.body.imageUrls.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const primaryFromBody = String(req.body.imageUrl ?? "").trim();
    const imageUrls = mergePayloadListingImageUrls(primaryFromBody, rawImageUrls);
    const imageUrl = imageUrls[0] || "";
    const orderType = String(req.body.orderType || "in_stock").trim() === "pre_order" ? "pre_order" : "in_stock";
    const processingTime = String(req.body.processingTime ?? "").trim().slice(0, 120);
    if (orderType === "pre_order" && !processingTime) {
      throw new AppError(400, "Processing time is required for pre-order listings.");
    }
    const mergedVariants = mergeAndValidateListingVariants(req.body, {
      option_name_a: "",
      option_name_b: "",
      option_values_a: [],
      option_values_b: [],
    });
    const row = {
      seller_id: req.user.id,
      title: String(req.body.title).trim(),
      description: String(req.body.description ?? "").trim(),
      price_cents: Number(req.body.priceCents),
      quantity: Math.max(0, Number(req.body.quantity)),
      vertical_id: categoryId.slice(0, 32),
      sub_id: req.body.subId != null ? String(req.body.subId).slice(0, 64) : null,
      fulfillment_modes: modes,
      city_label: String(req.body.cityLabel ?? "").trim(),
      lat: req.body.lat != null ? Number(req.body.lat) : null,
      lng: req.body.lng != null ? Number(req.body.lng) : null,
      image_url: imageUrl,
      image_urls: imageUrls.length ? imageUrls : imageUrl ? [imageUrl] : [],
      image_focal_rects: mergePayloadListingImageFocalRects(req.body.imageFocalRects, imageUrls.length || (imageUrl ? 1 : 0)),
      option_name_a: mergedVariants.option_name_a,
      option_values_a: mergedVariants.option_values_a,
      option_name_b: mergedVariants.option_name_b,
      option_values_b: mergedVariants.option_values_b,
      order_type: orderType,
      processing_time: processingTime,
      service_meta:
        req.body.serviceMeta != null && typeof req.body.serviceMeta === "object" && !Array.isArray(req.body.serviceMeta)
          ? req.body.serviceMeta
          : null,
      sold_count: 0,
      // Keep insert compatible with DB constraint: active|paused|sold.
      status: "active",
    };
    const cid = String(req.body.communityId || "").trim();
    if (cid) {
      const { data: commRows, error: cErr } = await supabaseAdmin.from("communities").select("id").eq("id", cid).limit(1);
      const comm = firstRow(commRows);
      if (cErr) throw new AppError(500, cErr.message);
      if (!comm) throw new AppError(400, "Unknown community.");
      row.community_id = cid;
    }
    let { data, error } = await supabaseAdmin.from("listings").insert(row).select("*").single();
    if (isListingsSchemaCacheOrMissingColumnError(error)) {
      const fallback = { ...row };
      for (const col of LISTINGS_OPTIONAL_PRODUCT_COLUMNS) delete fallback[col];
      ({ data, error } = await supabaseAdmin.from("listings").insert(fallback).select("*").single());
    }
    if (isListingsSchemaCacheOrMissingColumnError(error) && Object.prototype.hasOwnProperty.call(row, "image_urls")) {
      const withoutGallery = { ...row };
      delete withoutGallery.image_urls;
      for (const col of LISTINGS_OPTIONAL_PRODUCT_COLUMNS) delete withoutGallery[col];
      ({ data, error } = await supabaseAdmin.from("listings").insert(withoutGallery).select("*").single());
    }
    if (error?.code === "PGRST205") {
      throw new AppError(
        500,
        "Listings table missing (products are stored here). In Supabase: SQL Editor → paste and run repo file supabase/sql_editor_all_in_one.sql → Run. Then try Publish again.",
      );
    }
    if (isListingsSchemaCacheOrMissingColumnError(error)) {
      throw new AppError(
        503,
        "Listings `image_urls` (or product fields) are missing in the database. In Supabase SQL Editor run `supabase/migrations/20260502100000_listings_ensure_image_urls.sql` (or full `20260430235900_listings_add_product_fields.sql`), then `NOTIFY pgrst, 'reload schema';` or wait for the API schema cache to refresh.",
      );
    }
    if (error) throw new AppError(400, error.message);
    res.status(201).json({ listing: listingRowToApi(data) });
  } catch (e) {
    next(e);
  }
};

export const updateListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: existingRows, error: exErr } = await supabaseAdmin.from("listings").select("*").eq("id", id).limit(1);
    const existing = firstRow(existingRows);
    if (exErr) throw new AppError(500, exErr.message);
    if (!existing || existing.seller_id !== req.user.id) throw new AppError(404, "Listing not found.");
    const patch = {};
    if (req.body.title != null) patch.title = String(req.body.title).trim();
    if (req.body.description != null) patch.description = String(req.body.description).trim();
    if (req.body.priceCents != null) patch.price_cents = Number(req.body.priceCents);
    if (req.body.quantity != null) patch.quantity = Number(req.body.quantity);
    if (req.body.categories != null) patch.vertical_id = String(req.body.categories).slice(0, 32);
    else if (req.body.verticalId != null) patch.vertical_id = String(req.body.verticalId).slice(0, 32);
    if (req.body.subId !== undefined) patch.sub_id = req.body.subId == null ? null : String(req.body.subId).slice(0, 64);
    if (req.body.fulfillmentModes != null) patch.fulfillment_modes = req.body.fulfillmentModes;
    if (req.body.cityLabel != null) patch.city_label = String(req.body.cityLabel).trim();
    if (req.body.lat !== undefined) patch.lat = req.body.lat == null ? null : Number(req.body.lat);
    if (req.body.lng !== undefined) patch.lng = req.body.lng == null ? null : Number(req.body.lng);
    if (req.body.imageUrl != null && req.body.imageUrls != null) {
      const primary = String(req.body.imageUrl).trim();
      const rawUrls = Array.isArray(req.body.imageUrls)
        ? req.body.imageUrls.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      const imageUrls = mergePayloadListingImageUrls(primary, rawUrls);
      patch.image_urls = imageUrls;
      if (imageUrls.length > 0) patch.image_url = imageUrls[0];
      if (req.body.imageFocalRects != null) {
        patch.image_focal_rects = mergePayloadListingImageFocalRects(req.body.imageFocalRects, imageUrls.length);
      }
    } else if (req.body.imageUrls != null) {
      const imageUrls = mergePayloadListingImageUrls(
        "",
        Array.isArray(req.body.imageUrls) ? req.body.imageUrls.map((x) => String(x || "").trim()).filter(Boolean) : [],
      );
      patch.image_urls = imageUrls;
      if (imageUrls.length > 0) patch.image_url = imageUrls[0];
      if (req.body.imageFocalRects != null) {
        patch.image_focal_rects = mergePayloadListingImageFocalRects(req.body.imageFocalRects, imageUrls.length);
      }
    } else if (req.body.imageUrl != null) {
      patch.image_url = String(req.body.imageUrl).trim();
    } else if (req.body.imageFocalRects != null) {
      const existingUrls = dedupeListingImageUrlsOrdered(normalizeDbImageUrls(existing.image_urls));
      const urlCount =
        existingUrls.length ||
        (String(existing.image_url || "").trim() ? 1 : 0);
      patch.image_focal_rects = mergePayloadListingImageFocalRects(req.body.imageFocalRects, urlCount);
    }
    if (req.body.orderType != null) patch.order_type = String(req.body.orderType) === "pre_order" ? "pre_order" : "in_stock";
    if (req.body.processingTime != null) patch.processing_time = String(req.body.processingTime).trim().slice(0, 120);
    if (req.body.serviceMeta !== undefined) {
      patch.service_meta =
        req.body.serviceMeta != null && typeof req.body.serviceMeta === "object" && !Array.isArray(req.body.serviceMeta)
          ? req.body.serviceMeta
          : null;
    }
    const effectiveOrderType = String(patch.order_type ?? existing.order_type ?? "in_stock");
    const effectiveProcessingTime = String(patch.processing_time ?? existing.processing_time ?? "").trim();
    if (effectiveOrderType === "pre_order" && !effectiveProcessingTime) {
      throw new AppError(400, "Processing time is required for pre-order listings.");
    }
    const mergedVariants = mergeAndValidateListingVariants(req.body, existing);
    patch.option_name_a = mergedVariants.option_name_a;
    patch.option_values_a = mergedVariants.option_values_a;
    patch.option_name_b = mergedVariants.option_name_b;
    patch.option_values_b = mergedVariants.option_values_b;
    if (req.body.communityId !== undefined) {
      if (req.body.communityId == null || req.body.communityId === "") {
        patch.community_id = null;
      } else {
        const cid = String(req.body.communityId);
        const { data: commRows, error: cErr } = await supabaseAdmin.from("communities").select("id").eq("id", cid).limit(1);
        const comm = firstRow(commRows);
        if (cErr) throw new AppError(500, cErr.message);
        if (!comm) throw new AppError(400, "Unknown community.");
        patch.community_id = cid;
      }
    }
    if (req.body.status != null) {
      const nextStatus = String(req.body.status).trim().toLowerCase();
      if (!ALLOWED_LISTING_STATUSES.has(nextStatus)) {
        throw new AppError(400, "Invalid listing status.");
      }
      patch.status = nextStatus;
    }
    // Completing an order sets status "sold" when stock hits 0 (`patchOrder`). Restocking must return the listing to browse (`GET /listings` is active-only) unless the seller chose another status.
    if (req.body.status == null && String(existing.status || "").toLowerCase() === "sold") {
      const effectiveQty =
        patch.quantity !== undefined ? Number(patch.quantity) : Math.max(0, Number(existing.quantity) || 0);
      if (Number.isFinite(effectiveQty) && effectiveQty > 0) {
        patch.status = "active";
      }
    }
    patch.updated_at = new Date().toISOString();
    let { data, error } = await supabaseAdmin.from("listings").update(patch).eq("id", id).select("*").single();
    if (isListingsSchemaCacheOrMissingColumnError(error)) {
      const fallbackPatch = { ...patch };
      for (const col of LISTINGS_OPTIONAL_PRODUCT_COLUMNS) delete fallbackPatch[col];
      ({ data, error } = await supabaseAdmin.from("listings").update(fallbackPatch).eq("id", id).select("*").single());
    }
    if (isListingsSchemaCacheOrMissingColumnError(error) && Object.prototype.hasOwnProperty.call(patch, "image_urls")) {
      const withoutGallery = { ...patch };
      delete withoutGallery.image_urls;
      for (const col of LISTINGS_OPTIONAL_PRODUCT_COLUMNS) delete withoutGallery[col];
      ({ data, error } = await supabaseAdmin.from("listings").update(withoutGallery).eq("id", id).select("*").single());
    }
    if (isListingsSchemaCacheOrMissingColumnError(error)) {
      throw new AppError(
        503,
        "Database schema is missing listing columns (e.g. `image_urls`). Apply migration `supabase/migrations/20260502100000_listings_ensure_image_urls.sql` in Supabase SQL Editor, then run `NOTIFY pgrst, 'reload schema';`.",
      );
    }
    if (error) throw new AppError(400, error.message);
    res.json({ listing: listingRowToApi(data) });
  } catch (e) {
    next(e);
  }
};

export const deleteListing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin.from("listings").select("id,seller_id").eq("id", id).maybeSingle();
    if (!existing || existing.seller_id !== req.user.id) throw new AppError(404, "Listing not found.");
    const { error } = await supabaseAdmin.from("listings").delete().eq("id", id).eq("seller_id", req.user.id);
    if (
      error &&
      /foreign key|violates foreign key constraint|orders_listing_id_fkey|order_reviews_listing_id_fkey/i.test(
        String(error.message || ""),
      )
    ) {
      throw new AppError(
        503,
        "Database schema is outdated for listing hard delete. Apply migration `supabase/migrations/20260519121000_listings_hard_delete_order_refs_nullable.sql`, then run `NOTIFY pgrst, 'reload schema';`.",
      );
    }
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

export const listMyListings = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("seller_id", req.user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    const ratingMap = await aggregateSellerOrderRatingStatsBySellerId([req.user.id]);
    const rs = ratingMap.get(req.user.id) || { sellerAvgRating: null, sellerReviewCount: 0 };
    if (error?.code === "PGRST205")
      return res.json({
        listings: [],
        sellerAvgRating: rs.sellerAvgRating,
        sellerReviewCount: rs.sellerReviewCount,
      });
    if (error) throw new AppError(500, error.message);
    const mapped = (data || []).map(listingRowToApi);
    const listingIdsForRatings = mapped.map((l) => String(l?.id || "").trim()).filter(Boolean);
    const listingRatingMap =
      listingIdsForRatings.length > 0 ? await aggregateListingOrderRatingStatsByListingId(listingIdsForRatings) : new Map();
    const listingsWithRatings = mergeListingOrderReviewStatsIntoListings(mapped, listingRatingMap);
    res.json({
      listings: listingsWithRatings,
      sellerAvgRating: rs.sellerAvgRating,
      sellerReviewCount: rs.sellerReviewCount,
    });
  } catch (e) {
    next(e);
  }
};

/** Lightweight buyer→seller star aggregate for Profile (order_reviews). */
export const getMySellerRatings = async (req, res, next) => {
  try {
    const ratingMap = await aggregateSellerOrderRatingStatsBySellerId([req.user.id]);
    const rs = ratingMap.get(req.user.id) || { sellerAvgRating: null, sellerReviewCount: 0 };
    res.json({
      sellerAvgRating: rs.sellerAvgRating,
      sellerReviewCount: rs.sellerReviewCount,
    });
  } catch (e) {
    next(e);
  }
};

export const listFavorites = async (req, res, next) => {
  try {
    const { data: favs, error } = await supabaseAdmin
      .from("user_listing_favorites")
      .select("listing_id, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ favorites: [] });
    if (error) throw new AppError(500, error.message);
    const ids = (favs || []).map((f) => f.listing_id);
    if (ids.length === 0) return res.json({ favorites: [] });
    const { data: listings, error: lerr } = await supabaseAdmin.from("listings").select("*").in("id", ids);
    if (lerr) throw new AppError(500, lerr.message);
    const byId = new Map((listings || []).map((l) => [l.id, l]));
    const orderedRows = ids.map((id) => byId.get(id)).filter(Boolean);
    const mapped = orderedRows.map(listingRowToApi);
    const listingIdsForRatings = mapped.map((l) => String(l?.id || "").trim()).filter(Boolean);
    const listingRatingMap =
      listingIdsForRatings.length > 0 ? await aggregateListingOrderRatingStatsByListingId(listingIdsForRatings) : new Map();
    const ordered = mergeListingOrderReviewStatsIntoListings(mapped, listingRatingMap);
    res.json({ favorites: ordered });
  } catch (e) {
    next(e);
  }
};

export const addFavorite = async (req, res, next) => {
  try {
    const listingId = String(req.params.listingId);
    const { data: listing } = await supabaseAdmin.from("listings").select("id,status").eq("id", listingId).maybeSingle();
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not found.");
    const { error } = await supabaseAdmin.from("user_listing_favorites").upsert(
      { user_id: req.user.id, listing_id: listingId },
      { onConflict: "user_id,listing_id" },
    );
    if (error?.code === "PGRST205") throw new AppError(500, "Favorites table missing.");
    if (error) throw new AppError(400, error.message);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

export const removeFavorite = async (req, res, next) => {
  try {
    const listingId = String(req.params.listingId);
    const { error } = await supabaseAdmin
      .from("user_listing_favorites")
      .delete()
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId);
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

async function enrichCartRowsForApi(rows) {
  if (!rows?.length) return [];
  const listingIds = [...new Set(rows.map((r) => String(r.listing_id)))];
  const fullSelect = `${CART_LISTING_REQUIRED_SELECT},${CART_LISTING_OPTIONAL_COLUMNS.join(",")}`;
  let { data: listings, error: lerr } = await supabaseAdmin
    .from("listings")
    .select(fullSelect)
    .in("id", listingIds);
  if (lerr && (lerr.code === "PGRST204" || lerr.code === "42703" || /schema cache|does not exist/i.test(String(lerr.message || "")))) {
    // Backward compatibility: cart should still work on DBs that don't have newer listing product columns yet.
    ({ data: listings, error: lerr } = await supabaseAdmin
      .from("listings")
      .select(CART_LISTING_REQUIRED_SELECT)
      .in("id", listingIds));
  }
  if (lerr) throw new AppError(500, lerr.message);
  const listingById = new Map((listings || []).map((l) => [String(l.id), l]));
  const sellerIds = [...new Set((listings || []).map((l) => String(l.seller_id)).filter(Boolean))];
  let usernameById = new Map();
  if (sellerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,username").in("id", sellerIds);
    usernameById = new Map((profiles || []).map((p) => [String(p.id), String(p.username || "").trim()]));
  }
  const out = [];
  for (const row of rows) {
    const listing = listingById.get(String(row.listing_id));
    if (!listing) continue;
    const sid = String(listing.seller_id);
    const un = usernameById.get(sid);
    const sellerLabel = un ? `@${un}` : sid ? `Seller ${sid.slice(0, 8)}` : "Unknown seller";
    const meta = listingRowToApi(listing);
    const ftRow = fulfillmentTypeForCartApiRow(row, listing);
    const storedLs = String(row.line_signature ?? "").trim();
    const lineSignature =
      storedLs ||
      computeCartLineSignature(
        String(row.variant_signature ?? "").trim().slice(0, 512),
        ftRow,
        String(row.comment ?? "").trim().slice(0, 2000),
      );
    out.push({
      listingId: String(row.listing_id),
      lineSignature,
      variantSignature: String(row.variant_signature ?? ""),
      sellerId: sid,
      sellerLabel,
      title: String(listing.title || "Product"),
      description: String(listing.description || "").trim(),
      imageUrl: String(listing.image_url || "").trim(),
      unitPriceCents: Number(listing.price_cents) || 0,
      quantity: row.quantity,
      listingQuantity: Math.max(0, Number(listing.quantity) || 0),
      fulfillmentModes: Array.isArray(listing.fulfillment_modes) ? listing.fulfillment_modes.map(String) : [],
      fulfillmentType: ftRow,
      comment: String(row.comment || "").trim(),
      verticalId: meta.verticalId,
      categories: meta.categories,
      serviceMeta: meta.serviceMeta,
      orderType: meta.orderType,
      processingTime: meta.processingTime,
      optionNameA: meta.optionNameA,
      optionValuesA: meta.optionValuesA,
      optionNameB: meta.optionNameB,
      optionValuesB: meta.optionValuesB,
    });
  }
  return out;
}

export const listCartItems = async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("cart_items")
      .select("*")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ items: [] });
    if (error) throw new AppError(500, error.message);
    const items = await enrichCartRowsForApi(rows || []);
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const addCartItem = async (req, res, next) => {
  try {
    const listingId = String(req.body.listingId);
    const addQty = req.body.quantity != null ? Number(req.body.quantity) : 1;
    const comment = String(req.body.comment || "").trim().slice(0, 2000);
    const sigFromBody = String(req.body.variantSignature ?? "").trim().slice(0, 512);
    const variantSig = sigFromBody || variantSignatureFromBuyerComment(comment);
    if (!Number.isFinite(addQty) || addQty < 1) throw new AppError(400, "Invalid quantity.");
    const { data: listing, error: lerr } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "You cannot add your own listing to the cart.");
    const isCartSvc = listingRowIsService(listing);
    const maxStock = isCartSvc ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(listing.quantity) || 0);
    if (!isCartSvc && maxStock < 1) throw new AppError(400, "Out of stock. Current stock: 0.");
    const fulfillmentType = resolveBuyerFulfillmentForListing(listing, req.body.fulfillmentType);

    const { data: candidates, error: cErr } = await supabaseAdmin
      .from("cart_items")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("variant_signature", variantSig);
    if (cErr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (cErr) throw new AppError(500, cErr.message);

    let existing = null;
    for (const cand of candidates || []) {
      const storedFt = fulfillmentTypeForCartApiRow(cand, listing);
      if (storedFt !== fulfillmentType) continue;
      const mergedTry = comment || String(cand.comment || "").trim();
      const ls = computeCartLineSignature(variantSig, fulfillmentType, mergedTry);
      if (ls === effectiveLineSignatureFromCartRow(cand, listing)) {
        existing = cand;
        break;
      }
    }

    const mergedComment = comment || String(existing?.comment || "").trim();
    const lineSig = computeCartLineSignature(variantSig, fulfillmentType, mergedComment);
    const prevQty = Number(existing?.quantity) || 0;
    const mergedQty = prevQty ? prevQty + addQty : addQty;
    const newQty = Math.min(mergedQty, maxStock);
    if (newQty < 1) throw new AppError(400, "Not enough stock.");

    const now = new Date().toISOString();
    const rowPayload = {
      user_id: req.user.id,
      listing_id: listingId,
      line_signature: lineSig,
      variant_signature: variantSig,
      fulfillment_type: fulfillmentType,
      quantity: newQty,
      comment: mergedComment,
      updated_at: now,
    };
    const updatePayload = {
      quantity: newQty,
      comment: mergedComment,
      fulfillment_type: fulfillmentType,
      updated_at: now,
    };

    let uerr = null;
    if (existing) {
      ({ error: uerr } = await supabaseAdmin
        .from("cart_items")
        .update(updatePayload)
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId)
        .eq("line_signature", lineSig));
      if (isCartItemsMissingFulfillmentTypeColumnError(uerr)) {
        const { fulfillment_type: _omitFt, ...updateWithoutFt } = updatePayload;
        ({ error: uerr } = await supabaseAdmin
          .from("cart_items")
          .update(updateWithoutFt)
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId)
          .eq("line_signature", lineSig));
      }
      if (isCartItemsMissingLineSignatureColumnError(uerr)) {
        ({ error: uerr } = await supabaseAdmin
          .from("cart_items")
          .update(updatePayload)
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId)
          .eq("variant_signature", variantSig));
        if (isCartItemsMissingFulfillmentTypeColumnError(uerr)) {
          const { fulfillment_type: _omitFtL, ...updateWithoutFtL } = updatePayload;
          ({ error: uerr } = await supabaseAdmin
            .from("cart_items")
            .update(updateWithoutFtL)
            .eq("user_id", req.user.id)
            .eq("listing_id", listingId)
            .eq("variant_signature", variantSig));
        }
      }
    } else {
      let insertTry = rowPayload;
      ({ error: uerr } = await supabaseAdmin.from("cart_items").insert(insertTry));
      if (isCartItemsMissingFulfillmentTypeColumnError(uerr)) {
        const { fulfillment_type: _omitFt2, ...rowWithoutFt } = insertTry;
        insertTry = rowWithoutFt;
        ({ error: uerr } = await supabaseAdmin.from("cart_items").insert(insertTry));
      }
      if (isCartItemsMissingLineSignatureColumnError(uerr)) {
        const { line_signature: _omitLs, ...rowWithoutLs } = insertTry;
        insertTry = rowWithoutLs;
        ({ error: uerr } = await supabaseAdmin.from("cart_items").insert(insertTry));
      }
      if (isCartItemsMissingFulfillmentTypeColumnError(uerr)) {
        const { fulfillment_type: _omitFt2b, ...rowWithoutFt2 } = insertTry;
        insertTry = rowWithoutFt2;
        ({ error: uerr } = await supabaseAdmin.from("cart_items").insert(insertTry));
      }
      if (uerr && /duplicate key|unique constraint/i.test(postgrestErrorText(uerr))) {
        let upErr = null;
        let updatedRows = null;
        ({ data: updatedRows, error: upErr } = await supabaseAdmin
          .from("cart_items")
          .update(updatePayload)
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId)
          .eq("line_signature", lineSig)
          .select("listing_id"));
        if (isCartItemsMissingFulfillmentTypeColumnError(upErr)) {
          const { fulfillment_type: _omitFt3, ...updateWithoutFt } = updatePayload;
          ({ data: updatedRows, error: upErr } = await supabaseAdmin
            .from("cart_items")
            .update(updateWithoutFt)
            .eq("user_id", req.user.id)
            .eq("listing_id", listingId)
            .eq("line_signature", lineSig)
            .select("listing_id"));
        }
        if (isCartItemsMissingLineSignatureColumnError(upErr)) {
          ({ data: updatedRows, error: upErr } = await supabaseAdmin
            .from("cart_items")
            .update(updatePayload)
            .eq("user_id", req.user.id)
            .eq("listing_id", listingId)
            .eq("variant_signature", variantSig)
            .select("listing_id"));
          if (isCartItemsMissingFulfillmentTypeColumnError(upErr)) {
            const { fulfillment_type: _omitFt3b, ...updateWithoutFtB } = updatePayload;
            ({ data: updatedRows, error: upErr } = await supabaseAdmin
              .from("cart_items")
              .update(updateWithoutFtB)
              .eq("user_id", req.user.id)
              .eq("listing_id", listingId)
              .eq("variant_signature", variantSig)
              .select("listing_id"));
          }
        }
        uerr = upErr;
        if (!upErr && (!updatedRows || updatedRows.length === 0)) {
          throw new AppError(
            400,
            "Cart line conflict. Apply migration `20260504130000_cart_items_line_signature.sql` or resolve duplicate cart rows for this listing.",
          );
        }
      }
    }
    if (uerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (uerr) throw new AppError(400, uerr.message);
    const { data: rows } = await supabaseAdmin.from("cart_items").select("*").eq("user_id", req.user.id);
    const items = await enrichCartRowsForApi(rows || []);
    res.status(201).json({ items });
  } catch (e) {
    next(e);
  }
};

export const removeCartItem = async (req, res, next) => {
  try {
    const listingId = String(req.params.listingId);
    const lineSig = String(req.query.lineSignature ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(lineSig)) {
      throw new AppError(400, "Query parameter lineSignature (64-char hex) is required.");
    }
    let { error } = await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("line_signature", lineSig);
    if (error?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (isCartItemsMissingLineSignatureColumnError(error)) {
      const { data: listing, error: lerr } = await supabaseAdmin
        .from("listings")
        .select("fulfillment_modes")
        .eq("id", listingId)
        .maybeSingle();
      if (lerr) throw new AppError(500, lerr.message);
      const { data: cartRows, error: cerr } = await supabaseAdmin
        .from("cart_items")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId);
      if (cerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
      if (cerr) throw new AppError(500, cerr.message);
      const hit = (cartRows || []).find((r) => effectiveLineSignatureFromCartRow(r, listing) === lineSig);
      if (!hit) {
        res.status(204).send();
        return;
      }
      const variantSig = String(hit.variant_signature ?? "").trim().slice(0, 512);
      ({ error } = await supabaseAdmin
        .from("cart_items")
        .delete()
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId)
        .eq("variant_signature", variantSig));
    }
    if (error?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

export const patchCartItem = async (req, res, next) => {
  try {
    const listingId = String(req.params.listingId);
    const oldLineSig = String(req.query.lineSignature ?? "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(oldLineSig)) {
      throw new AppError(400, "Query parameter lineSignature (64-char hex) is required.");
    }
    const newQty = req.body.quantity != null ? Number(req.body.quantity) : NaN;
    if (!Number.isFinite(newQty) || newQty < 1 || !Number.isInteger(newQty)) throw new AppError(400, "Invalid quantity.");

    const { data: listing, error: lerr } = await supabaseAdmin
      .from("listings")
      .select("quantity,status,seller_id,fulfillment_modes")
      .eq("id", listingId)
      .maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(400, "Listing no longer available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "Invalid cart item.");
    const maxStock = Math.max(0, Number(listing.quantity) || 0);
    if (maxStock < 1) throw new AppError(400, "Out of stock. Current stock: 0.");
    const capped = Math.min(newQty, maxStock);
    if (capped < 1) throw new AppError(400, "Invalid quantity.");

    let useLegacyCartLineKey = false;
    let row = null;
    let rerr = null;
    ({ data: row, error: rerr } = await supabaseAdmin
      .from("cart_items")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("line_signature", oldLineSig)
      .maybeSingle());
    if (isCartItemsMissingLineSignatureColumnError(rerr)) {
      useLegacyCartLineKey = true;
      const { data: cartRows, error: cerr } = await supabaseAdmin
        .from("cart_items")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId);
      if (cerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
      if (cerr) throw new AppError(500, cerr.message);
      row = (cartRows || []).find((r) => effectiveLineSignatureFromCartRow(r, listing) === oldLineSig) || null;
    } else if (rerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    else if (rerr) throw new AppError(500, rerr.message);
    if (!row) throw new AppError(404, "Not in cart.");

    const variantSig = String(row.variant_signature ?? "").trim().slice(0, 512);
    const comment = String(row.comment ?? "").trim().slice(0, 2000);
    let fulfillmentType = fulfillmentTypeForCartApiRow(row, listing);
    if (req.body.fulfillmentType != null && req.body.fulfillmentType !== "") {
      fulfillmentType = resolveBuyerFulfillmentForListing(listing, req.body.fulfillmentType);
    }

    const newLineSig = computeCartLineSignature(variantSig, fulfillmentType, comment);
    const now = new Date().toISOString();

    const finishOk = async () => {
      const { data: rows } = await supabaseAdmin.from("cart_items").select("*").eq("user_id", req.user.id);
      const items = await enrichCartRowsForApi(rows || []);
      res.json({ items });
    };

    const applyCartLineKeyEq = (q, lineHex) => {
      if (useLegacyCartLineKey) return q.eq("variant_signature", variantSig);
      return q.eq("line_signature", lineHex);
    };

    if (newLineSig === oldLineSig) {
      const patch = {
        quantity: capped,
        fulfillment_type: fulfillmentType,
        updated_at: now,
      };
      let { error: uerr } = await applyCartLineKeyEq(
        supabaseAdmin.from("cart_items").update(patch).eq("user_id", req.user.id).eq("listing_id", listingId),
        oldLineSig,
      );
      if (isCartItemsMissingFulfillmentTypeColumnError(uerr) && Object.prototype.hasOwnProperty.call(patch, "fulfillment_type")) {
        const { fulfillment_type: _omitFt, ...patchWithoutFt } = patch;
        ({ error: uerr } = await applyCartLineKeyEq(
          supabaseAdmin
            .from("cart_items")
            .update(patchWithoutFt)
            .eq("user_id", req.user.id)
            .eq("listing_id", listingId),
          oldLineSig,
        ));
      }
      if (uerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
      if (uerr) throw new AppError(400, uerr.message);
      await finishOk();
      return;
    }

    let dest = null;
    if (useLegacyCartLineKey) {
      const { data: cartForDest, error: dErr } = await supabaseAdmin
        .from("cart_items")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId);
      if (dErr) throw new AppError(500, dErr.message);
      dest =
        (cartForDest || []).find((r) => effectiveLineSignatureFromCartRow(r, listing) === newLineSig) || null;
    } else {
      const r = await supabaseAdmin
        .from("cart_items")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId)
        .eq("line_signature", newLineSig)
        .maybeSingle();
      dest = r.data;
    }

    const destIsAnotherLine =
      !!dest &&
      (useLegacyCartLineKey
        ? effectiveLineSignatureFromCartRow(dest, listing) !== oldLineSig
        : String(dest.line_signature || "").trim() !== oldLineSig);

    if (dest && destIsAnotherLine) {
      const mergedQty = Math.min(maxStock, Number(dest.quantity) + capped);
      let { error: delErr } = await applyCartLineKeyEq(
        supabaseAdmin.from("cart_items").delete().eq("user_id", req.user.id).eq("listing_id", listingId),
        oldLineSig,
      );
      if (delErr) throw new AppError(400, delErr.message);

      const mergePatch = {
        quantity: mergedQty,
        fulfillment_type: fulfillmentType,
        updated_at: now,
      };
      let qUp = supabaseAdmin
        .from("cart_items")
        .update(mergePatch)
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId);
      if (useLegacyCartLineKey) {
        qUp = qUp.eq("variant_signature", String(dest.variant_signature ?? "").trim().slice(0, 512));
      } else {
        qUp = qUp.eq("line_signature", newLineSig);
      }
      let { error: upErr } = await qUp;
      if (isCartItemsMissingFulfillmentTypeColumnError(upErr) && Object.prototype.hasOwnProperty.call(mergePatch, "fulfillment_type")) {
        const { fulfillment_type: _omitFt2, ...mergeWithoutFt } = mergePatch;
        let qUp2 = supabaseAdmin
          .from("cart_items")
          .update(mergeWithoutFt)
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId);
        if (useLegacyCartLineKey) {
          qUp2 = qUp2.eq("variant_signature", String(dest.variant_signature ?? "").trim().slice(0, 512));
        } else {
          qUp2 = qUp2.eq("line_signature", newLineSig);
        }
        ({ error: upErr } = await qUp2);
      }
      if (upErr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
      if (upErr) throw new AppError(400, upErr.message);
      await finishOk();
      return;
    }

    const movePatch = {
      ...(useLegacyCartLineKey ? {} : { line_signature: newLineSig }),
      fulfillment_type: fulfillmentType,
      quantity: capped,
      updated_at: now,
    };
    let { error: uerr } = await applyCartLineKeyEq(
      supabaseAdmin.from("cart_items").update(movePatch).eq("user_id", req.user.id).eq("listing_id", listingId),
      oldLineSig,
    );
    if (isCartItemsMissingFulfillmentTypeColumnError(uerr) && Object.prototype.hasOwnProperty.call(movePatch, "fulfillment_type")) {
      const { fulfillment_type: _omitFt3, ...moveWithoutFt } = movePatch;
      ({ error: uerr } = await applyCartLineKeyEq(
        supabaseAdmin
          .from("cart_items")
          .update(moveWithoutFt)
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId),
        oldLineSig,
      ));
    }
    if (uerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (uerr) throw new AppError(400, uerr.message);
    await finishOk();
  } catch (e) {
    next(e);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const listingId = String(req.body.listingId);
    const fulfillmentType = String(req.body.fulfillmentType);
    let buyerComment = String(req.body.comment || "").trim().slice(0, 2000);
    if (!["pickup", "delivery"].includes(fulfillmentType)) throw new AppError(400, "Invalid fulfillment type.");
    const quantity = req.body.quantity != null ? Number(req.body.quantity) : 1;
    if (quantity < 1) throw new AppError(400, "Invalid quantity.");
    const { data: listing, error: lerr } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "You cannot order your own listing.");
    if (!listing.fulfillment_modes?.includes(fulfillmentType)) throw new AppError(400, "This listing does not support that fulfillment option.");
    const isSvc = listingRowIsService(listing);
    const orderQty = isSvc ? 1 : quantity;
    if (isSvc && quantity !== 1) {
      /* Services book one session per request; ignore client qty > 1. */
    }
    const maxStock = isSvc ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(listing.quantity) || 0);
    if (orderQty > maxStock) throw new AppError(400, `Not enough stock. Requested: ${orderQty}, available: ${maxStock}.`);
    let serviceBookingDateIn = "";
    let serviceBookingTimeIn = "";
    if (isSvc) {
      const rawD = String(req.body.serviceBookingDate ?? req.body.service_booking_date ?? "").trim();
      const rawT = String(req.body.serviceBookingTime ?? req.body.service_booking_time ?? "").trim();
      serviceBookingDateIn = normalizeSlotDateIso(rawD) || rawD;
      serviceBookingTimeIn = normalizeSlotTimeHm(rawT) || rawT;
      const slotErr = validateServiceBookingSlotForOrder(listing, serviceBookingDateIn, serviceBookingTimeIn);
      if (slotErr) throw new AppError(400, slotErr);
    }
    const codGoodsCents = listing.price_cents * orderQty;
    const initialStatus = "placed";
    const bodySig = String(req.body.variantSignature ?? "").trim().slice(0, 512);
    const targetVariantSig = bodySig || variantSignatureFromBuyerComment(buyerComment);
    const { data: existingPlacedOrders, error: existingErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("listing_id", listingId)
      .eq("buyer_id", req.user.id)
      .eq("status", initialStatus);
    if (existingErr) throw new AppError(500, existingErr.message);
    const matchingPlaced = isSvc
      ? (existingPlacedOrders || []).filter((o) => {
          if (String(o?.fulfillment_type ?? "").trim() !== fulfillmentType) return false;
          const existingSlot = effectiveServiceSlotFromOrderRow(o);
          const newSlot =
            serviceBookingDateIn && serviceBookingTimeIn
              ? { date: serviceBookingDateIn, time: serviceBookingTimeIn }
              : null;
          if (newSlot && existingSlot && existingSlot.date === newSlot.date && existingSlot.time === newSlot.time)
            return true;
          return false;
        })
      : (existingPlacedOrders || []).filter((o) => {
          if (effectiveVariantSignatureFromOrderRow(o) !== targetVariantSig) return false;
          if (String(o?.fulfillment_type ?? "").trim() !== fulfillmentType) return false;
          return String(o?.buyer_comment ?? "").trim() === buyerComment;
        });
    if (isSvc && serviceBookingDateIn && serviceBookingTimeIn) {
      const excludeOrderIds = matchingPlaced.map((o) => String(o?.id || "")).filter(Boolean);
      const { taken } = await findConflictingServiceBooking(supabaseAdmin, {
        listingId,
        dateIso: serviceBookingDateIn,
        timeHm: serviceBookingTimeIn,
        excludeOrderIds,
      });
      if (taken) throw new AppError(409, "That time slot is already booked. Choose another.");
      const prefix = `${formatServiceBookingRequestLine(serviceBookingDateIn, serviceBookingTimeIn)}\n`;
      buyerComment = `${prefix}${buyerComment}`.trim().slice(0, 2000);
    }
    let preferredRowId = null;
    const newBuyerCourier =
      fulfillmentType === "delivery" ? parseOptionalCourierContributionCents(req.body.buyerCourierContributionCents) ?? 0 : 0;

    if (matchingPlaced.length > 0) {
      const ordered = [...matchingPlaced].sort((a, b) => {
        const at = String(a?.created_at || "");
        const bt = String(b?.created_at || "");
        return at.localeCompare(bt);
      });
      const primary = ordered[0];
      const existingQtyTotal = ordered.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity) || 0), 0);
      const mergedQty = existingQtyTotal + orderQty;
      const mergedBuyerComment =
        buyerComment || String(primary?.buyer_comment || "").trim();
      const mergedBuyerPool = ordered.reduce((s, row) => s + Math.max(0, Number(row?.buyer_courier_contribution_cents) || 0), 0) + newBuyerCourier;
      const mergedSellerPool = ordered.reduce((s, row) => s + Math.max(0, Number(row?.seller_courier_contribution_cents) || 0), 0);
      const patch = {
        quantity: mergedQty,
        cod_goods_cents: listing.price_cents * mergedQty,
        // Keep latest selected fulfillment option for the merged pending order.
        fulfillment_type: fulfillmentType,
        buyer_comment: mergedBuyerComment,
        variant_signature: targetVariantSig,
        buyer_courier_contribution_cents: mergedBuyerPool,
        seller_courier_contribution_cents: mergedSellerPool,
        cod_delivery_cents: deliveryCodTotalFromSplit(mergedBuyerPool, mergedSellerPool),
        ...(isSvc && serviceBookingDateIn && serviceBookingTimeIn
          ? { service_booking_date: serviceBookingDateIn, service_booking_time: serviceBookingTimeIn }
          : {}),
      };
      const { data: updated, error: uerr } = await updateOrderRowRetryWithoutMissingColumns(primary.id, patch);
      if (uerr) throw new AppError(400, uerr.message);
      preferredRowId = String(updated?.id || primary.id);
      const duplicateIds = ordered.slice(1).map((row) => row?.id).filter(Boolean);
      if (duplicateIds.length > 0) {
        const { error: derr } = await supabaseAdmin.from("orders").delete().in("id", duplicateIds);
        if (derr) throw new AppError(500, derr.message);
      }
    } else {
      const row = {
        listing_id: listingId,
        buyer_id: req.user.id,
        seller_id: listing.seller_id,
        quantity: orderQty,
        fulfillment_type: fulfillmentType,
        status: initialStatus,
        cod_goods_cents: codGoodsCents,
        buyer_courier_contribution_cents: newBuyerCourier,
        seller_courier_contribution_cents: 0,
        cod_delivery_cents: deliveryCodTotalFromSplit(newBuyerCourier, 0),
        buyer_comment: buyerComment,
        variant_signature: targetVariantSig,
        ...(isSvc && serviceBookingDateIn && serviceBookingTimeIn
          ? { service_booking_date: serviceBookingDateIn, service_booking_time: serviceBookingTimeIn }
          : {}),
      };
      let insertPayload = { ...row };
      let data = null;
      let error = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        ({ data, error } = await supabaseAdmin.from("orders").insert(insertPayload).select("*").single());
        if (!error) break;
        if (String(error?.code || "") === "23505" && isSvc && serviceBookingDateIn && serviceBookingTimeIn) {
          throw new AppError(409, "That time slot is no longer available. Choose another.");
        }
        if (isBuyerCommentMissingError(error) && Object.prototype.hasOwnProperty.call(insertPayload, "buyer_comment")) {
          const next = { ...insertPayload };
          delete next.buyer_comment;
          insertPayload = next;
          continue;
        }
        if (isVariantSignatureMissingError(error) && Object.prototype.hasOwnProperty.call(insertPayload, "variant_signature")) {
          const next = { ...insertPayload };
          delete next.variant_signature;
          insertPayload = next;
          continue;
        }
        if (
          Object.prototype.hasOwnProperty.call(insertPayload, "service_booking_date") &&
          /service_booking_date|service_booking_time|schema cache|Could not find/i.test(String(error?.message || ""))
        ) {
          const next = { ...insertPayload };
          delete next.service_booking_date;
          delete next.service_booking_time;
          insertPayload = next;
          continue;
        }
        if (isMissingOrdersCourierContributionColumn(error)) {
          const next = { ...insertPayload };
          delete next.buyer_courier_contribution_cents;
          delete next.seller_courier_contribution_cents;
          insertPayload = next;
          continue;
        }
        break;
      }
      if (error?.code === "PGRST205") throw new AppError(500, "Orders table missing.");
      if (error) throw new AppError(400, error.message);
      preferredRowId = String(data?.id || "");
    }

    // Merge any duplicate `placed` rows for this buyer+listing (e.g. concurrent POST /orders).
    const finalized = await consolidateBuyerListingStatusOrders({
      buyerId: req.user.id,
      listingId,
      status: initialStatus,
      fulfillmentType: null,
      preferredId: preferredRowId || null,
      skipPlacedConsolidationMerge: isSvc,
    });
    if (!finalized) throw new AppError(500, "Could not finalize order.");
    await notifyUserOrderEvent({
      recipientUserId: finalized.seller_id,
      actorUserId: req.user.id,
      orderId: finalized.id,
      recipientRole: "seller",
      title: "New order",
      body: listing?.title
        ? `A buyer placed an order for “${String(listing.title).trim().slice(0, 120)}”.`
        : "A buyer placed a new order.",
      orderStatusForTab: finalized.status,
    });
    res.status(201).json({ order: orderRowToApi(finalized, null, listing) });
  } catch (e) {
    next(e);
  }
};

const consolidateBuyerListingStatusOrders = async ({
  buyerId,
  listingId,
  status,
  fulfillmentType,
  preferredId = null,
  skipPlacedConsolidationMerge = false,
}) => {
  let q = supabaseAdmin
    .from("orders")
    .select("*")
    .eq("buyer_id", buyerId)
    .eq("listing_id", listingId)
    .eq("status", status);
  if (fulfillmentType) q = q.eq("fulfillment_type", fulfillmentType);
  const { data: rows, error } = await q;
  if (error) throw new AppError(500, error.message);
  const items = Array.isArray(rows) ? rows : [];
  if (items.length === 0) return null;

  if (skipPlacedConsolidationMerge && String(status || "").toLowerCase() === "placed") {
    const pref = preferredId ? items.find((r) => String(r.id) === String(preferredId)) : null;
    return pref ?? items[0];
  }

  /** Never merge pipeline / terminal orders — only duplicate `placed` rows (concurrent checkout). */
  if (String(status || "").toLowerCase() !== "placed") {
    const pref = preferredId ? items.find((r) => String(r.id) === String(preferredId)) : null;
    return pref ?? items[0];
  }

  const preferred = preferredId ? items.find((r) => String(r.id) === String(preferredId)) : null;
  const base = preferred || items[0];
  const anchorSig = effectiveVariantSignatureFromOrderRow(base);
  const anchorFulfillment = String(base?.fulfillment_type ?? "").trim();
  const anchorComment = String(base?.buyer_comment ?? "").trim();
  const scoped = items.filter((r) => {
    if (effectiveVariantSignatureFromOrderRow(r) !== anchorSig) return false;
    if (String(r?.fulfillment_type ?? "").trim() !== anchorFulfillment) return false;
    return String(r?.buyer_comment ?? "").trim() === anchorComment;
  });
  if (scoped.length === 0) return null;
  if (scoped.length === 1) return scoped[0];

  const sorted = [...scoped].sort((a, b) => String(a?.created_at || "").localeCompare(String(b?.created_at || "")));
  const primary = preferred && scoped.some((r) => String(r.id) === String(preferred.id)) ? preferred : sorted[0];
  const others = sorted.filter((r) => String(r.id) !== String(primary.id));
  const totalQty = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.quantity) || 0), 0);
  const totalGoods = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.cod_goods_cents) || 0), 0);
  const totalBuyerPool = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.buyer_courier_contribution_cents) || 0), 0);
  const totalSellerPool = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.seller_courier_contribution_cents) || 0), 0);
  const totalDelivery = deliveryCodTotalFromSplit(totalBuyerPool, totalSellerPool);

  let mergedBuyerComment = "";
  let bestCommentTs = "";
  for (const r of sorted) {
    const c = String(r?.buyer_comment ?? "").trim();
    if (!c) continue;
    const ts = String(r?.updated_at || r?.created_at || "");
    if (ts >= bestCommentTs) {
      bestCommentTs = ts;
      mergedBuyerComment = c;
    }
  }

  const patch = {
    quantity: totalQty,
    cod_goods_cents: totalGoods,
    buyer_courier_contribution_cents: totalBuyerPool,
    seller_courier_contribution_cents: totalSellerPool,
    cod_delivery_cents: totalDelivery,
    buyer_comment: mergedBuyerComment,
    variant_signature: anchorSig,
  };
  const { data: updated, error: uerr } = await updateOrderRowRetryWithoutMissingColumns(primary.id, patch);
  if (uerr) throw new AppError(500, uerr.message);

  const duplicateIds = others.map((r) => r?.id).filter(Boolean);
  if (duplicateIds.length > 0) {
    const { error: derr } = await supabaseAdmin.from("orders").delete().in("id", duplicateIds);
    if (derr) throw new AppError(500, derr.message);
  }
  return updated;
};

export const listOrders = async (req, res, next) => {
  try {
    const role = String(req.query.role || "buyer");
    const pageLimit = parsePositiveInt(req.query.limit, DEFAULT_ORDERS_LIMIT, MAX_ORDERS_LIMIT);
    const pageOffset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
    let q = supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);
    if (role === "seller") q = q.eq("seller_id", req.user.id);
    else q = q.eq("buyer_id", req.user.id);
    const { data, error } = await q;
    if (error?.code === "PGRST205") return res.json({ orders: [] });
    if (error) throw new AppError(500, error.message);
    const rows = data || [];
    const orderIds = rows.map((r) => r?.id).filter(Boolean);
    const reviewByOrderId = new Map();
    const courierReviewByOrderId = new Map();
    if (orderIds.length > 0) {
      const { data: revs, error: rerr } = await supabaseAdmin.from("order_reviews").select("*").in("order_id", orderIds);
      if (!rerr && Array.isArray(revs)) {
        for (const r of revs) {
          if (r?.order_id) reviewByOrderId.set(String(r.order_id), r);
        }
      }
      const { data: crevs, error: cerr } = await supabaseAdmin.from("courier_delivery_reviews").select("*").in("order_id", orderIds);
      if (!cerr && Array.isArray(crevs)) {
        for (const r of crevs) {
          if (r?.order_id) courierReviewByOrderId.set(String(r.order_id), r);
        }
      }
    }
    const listingIds = [...new Set(rows.map((r) => String(r?.listing_id || "")).filter(Boolean))];
    const listingById = new Map();
    if (listingIds.length > 0) {
      const { data: listings, error: lerr } = await supabaseAdmin
        .from("listings")
        .select("id, title, image_url, image_urls, community_id, vertical_id, categories, sub_id")
        .in("id", listingIds);
      if (!lerr && Array.isArray(listings)) {
        for (const L of listings) {
          if (L?.id) listingById.set(String(L.id), L);
        }
      }
    }
    const courierOrderIds =
      orderIds.length > 0 ? await orderIdsWithAcceptedCommunityCourier(orderIds) : new Set();

    let ratingExtrasByOrderId = new Map();
    if (role === "buyer" && orderIds.length > 0) {
      const { courierIdByOrderId } = await buyerCourierMapsForList(orderIds);
      for (const row of rows) {
        const oid = String(row.id || "").trim();
        const hasCc = courierOrderIds.has(oid);
        const cid = hasCc ? courierIdByOrderId.get(oid) || "" : "";
        ratingExtrasByOrderId.set(
          oid,
          resolveBuyerReviewEligibilityForOrder(row, {
            hasCommunityCourierDelivery: hasCc,
            courierId: cid,
          }),
        );
      }
    }

    res.json({
      orders: rows.map((row) => {
        const oid = String(row.id || "").trim();
        const extra = ratingExtrasByOrderId.get(oid);
        return orderRowToApi(
          row,
          reviewByOrderId.get(String(row.id)) || null,
          listingById.get(String(row.listing_id)) || null,
          courierReviewByOrderId.get(String(row.id)) || null,
          {
            hasCommunityCourierDelivery: courierOrderIds.has(String(row.id)),
            ...(role === "buyer" && extra
              ? { buyerMayRateSeller: extra.buyerMayRateSeller, buyerMayRateCourier: extra.buyerMayRateCourier }
              : role === "seller"
                ? { buyerMayRateSeller: false, buyerMayRateCourier: false }
                : {}),
          },
        );
      }),
      page: {
        limit: pageLimit,
        offset: pageOffset,
        returned: rows.length,
        hasMore: rows.length === pageLimit,
      },
    });
  } catch (e) {
    next(e);
  }
};

function parseOrderReviewStarBody(value) {
  if (value === undefined || value === null || value === "") return { set: false, n: null };
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 5) return { set: true, n: null };
  return { set: true, n };
}

export const upsertOrderReview = async (req, res, next) => {
  try {
    const REVIEW_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const { id } = req.params;
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const pr = parseOrderReviewStarBody(b.productRating ?? b.product_rating);
    const sr = parseOrderReviewStarBody(b.sellerRating ?? b.seller_rating);
    const productTextIn =
      Object.prototype.hasOwnProperty.call(b, "productReviewText") ||
      Object.prototype.hasOwnProperty.call(b, "product_review_text");
    const sellerTextIn =
      Object.prototype.hasOwnProperty.call(b, "sellerReviewText") ||
      Object.prototype.hasOwnProperty.call(b, "seller_review_text");
    const productReviewText = productTextIn
      ? String(b.productReviewText ?? b.product_review_text ?? "").trim().slice(0, 2000)
      : undefined;
    const sellerReviewText = sellerTextIn
      ? String(b.sellerReviewText ?? b.seller_review_text ?? "").trim().slice(0, 2000)
      : undefined;

    if (pr.set && pr.n === null) throw new AppError(400, "Product rating must be between 1 and 5.");
    if (sr.set && sr.n === null) throw new AppError(400, "Seller rating must be between 1 and 5.");

    const touchesRating = pr.set || sr.set;
    const touchesText = productTextIn || sellerTextIn;
    if (!touchesRating && !touchesText) {
      throw new AppError(400, "Provide a product or seller rating, or update review text.");
    }

    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!order) throw new AppError(404, "Order not found.");
    if (order.buyer_id !== req.user.id) throw new AppError(403, "Only the buyer can review this order.");
    if (order.status !== "completed") throw new AppError(400, "You can only review completed orders.");

    const now = new Date().toISOString();
    const { data: existing, error: exErr } = await supabaseAdmin.from("order_reviews").select("*").eq("order_id", id).maybeSingle();
    if (isOrderReviewsSchemaError(exErr)) throw new AppError(500, `Order reviews are not available (${ORDER_REVIEWS_SETUP_HINT})`);
    if (exErr) throw new AppError(500, exErr.message);

    if (!existing?.id && !pr.set && !sr.set) {
      throw new AppError(400, "Submit at least a product or seller star rating.");
    }

    const touchesProductSection = pr.set || productTextIn;
    const touchesSellerSection = sr.set || sellerTextIn;

    /** DB FK used to require `listings.id`; soft-deleted listings still exist. Hard-removed rows break inserts unless `listing_id` is nullable (see migration `20260517120000_order_reviews_listing_nullable_fk.sql`). */
    const orderListingIdRaw = order.listing_id != null ? String(order.listing_id).trim() : "";
    let resolvedListingIdForReview = orderListingIdRaw || null;
    if (orderListingIdRaw) {
      const { data: listingStillExists, error: listingLookupErr } = await supabaseAdmin
        .from("listings")
        .select("id")
        .eq("id", orderListingIdRaw)
        .maybeSingle();
      if (!listingLookupErr && !listingStillExists) {
        /** Allow product + seller saves with `listing_id` null (listing aggregates skip null); requires nullable FK migration. */
        resolvedListingIdForReview = null;
      }
    }

    const productStartedAtRaw = existing?.product_rating_started_at ?? existing?.created_at ?? null;
    const sellerStartedAtRaw = existing?.seller_rating_started_at ?? existing?.created_at ?? null;
    const productDeadlineMs = existing?.product_rating != null ? new Date(productStartedAtRaw).getTime() + REVIEW_EDIT_WINDOW_MS : NaN;
    const sellerDeadlineMs = existing?.seller_rating != null ? new Date(sellerStartedAtRaw).getTime() + REVIEW_EDIT_WINDOW_MS : NaN;
    if (
      existing?.id &&
      existing?.product_rating != null &&
      touchesProductSection &&
      Number.isFinite(productDeadlineMs) &&
      nowMs > productDeadlineMs
    ) {
      throw new AppError(400, "Product rating edit window expired (72 hours).");
    }
    if (
      existing?.id &&
      existing?.seller_rating != null &&
      touchesSellerSection &&
      Number.isFinite(sellerDeadlineMs) &&
      nowMs > sellerDeadlineMs
    ) {
      throw new AppError(400, "Seller rating edit window expired (72 hours).");
    }

    const nextProductRating = existing?.id
      ? pr.set
        ? pr.n
        : existing.product_rating ?? null
      : pr.set
        ? pr.n
        : null;
    const nextSellerRating = existing?.id ? (sr.set ? sr.n : existing.seller_rating ?? null) : sr.set ? sr.n : null;

    const nextProductText = existing?.id
      ? productTextIn
        ? productReviewText || null
        : existing.product_review_text ?? null
      : productTextIn
        ? productReviewText || null
        : null;
    const nextSellerText = existing?.id
      ? sellerTextIn
        ? sellerReviewText || null
        : existing.seller_review_text ?? null
      : sellerTextIn
        ? sellerReviewText || null
        : null;

    if (nextProductRating == null && nextSellerRating == null) {
      throw new AppError(400, "At least one of product or seller ratings must be set.");
    }
    const nextProductRatingStartedAt = existing?.id
      ? existing.product_rating != null
        ? existing.product_rating_started_at ?? existing.created_at ?? now
        : nextProductRating != null
          ? now
          : null
      : nextProductRating != null
        ? now
        : null;
    const nextSellerRatingStartedAt = existing?.id
      ? existing.seller_rating != null
        ? existing.seller_rating_started_at ?? existing.created_at ?? now
        : nextSellerRating != null
          ? now
          : null
      : nextSellerRating != null
        ? now
        : null;

    let reviewRow;
    if (existing?.id) {
      const updatePayload = {
        product_rating: nextProductRating,
        seller_rating: nextSellerRating,
        product_review_text: nextProductText,
        seller_review_text: nextSellerText,
        product_rating_started_at: nextProductRatingStartedAt,
        seller_rating_started_at: nextSellerRatingStartedAt,
        updated_at: now,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: resolvedListingIdForReview,
      };
      let { data: updated, error: uerr } = await supabaseAdmin
        .from("order_reviews")
        .update(updatePayload)
        .eq("order_id", id)
        .select("*")
        .single();
      if (uerr && isOrderReviewTimerColumnMissingError(uerr)) {
        const { product_rating_started_at, seller_rating_started_at, ...updateWithoutTimers } = updatePayload;
        const retry = await supabaseAdmin
          .from("order_reviews")
          .update(updateWithoutTimers)
          .eq("order_id", id)
          .select("*")
          .single();
        updated = retry.data;
        uerr = retry.error;
      }
      if (isOrderReviewsSchemaError(uerr)) {
        reviewRow = await upsertOrderReviewLegacyRow({
          id,
          order,
          existing,
          pr,
          sr,
          productTextIn,
          sellerTextIn,
          productReviewText,
          sellerReviewText,
          now,
          resolvedListingIdForReview,
        });
      }
      if (reviewRow) {
        // handled by legacy compatibility write
      } else
      if (uerr) {
        const code = String(uerr.code || "");
        const msg = String(uerr.message || "");
        if (code === "23503" || /foreign key|violates foreign key/i.test(msg)) {
          throw new AppError(
            503,
            `Could not link this review to the product listing (${ORDER_REVIEWS_SETUP_HINT}). If the listing was removed, run migration \`20260517120000_order_reviews_listing_nullable_fk.sql\` then NOTIFY pgrst.`,
          );
        }
        if (code === "23502" && /listing_id/i.test(msg)) {
          throw new AppError(
            503,
            "Apply migration `20260517120000_order_reviews_listing_nullable_fk.sql` so seller-only reviews save when the product listing row is missing.",
          );
        }
        throw new AppError(500, uerr.message);
      }
      reviewRow = reviewRow || updated;
    } else {
      const insertPayload = {
        order_id: id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: resolvedListingIdForReview,
        product_rating: nextProductRating,
        seller_rating: nextSellerRating,
        product_review_text: nextProductText,
        seller_review_text: nextSellerText,
        product_rating_started_at: nextProductRatingStartedAt,
        seller_rating_started_at: nextSellerRatingStartedAt,
        created_at: now,
        updated_at: now,
      };
      let { data: inserted, error: ierr } = await supabaseAdmin
        .from("order_reviews")
        .insert(insertPayload)
        .select("*")
        .single();
      if (ierr && isOrderReviewTimerColumnMissingError(ierr)) {
        const { product_rating_started_at, seller_rating_started_at, ...insertWithoutTimers } = insertPayload;
        const retry = await supabaseAdmin
          .from("order_reviews")
          .insert(insertWithoutTimers)
          .select("*")
          .single();
        inserted = retry.data;
        ierr = retry.error;
      }
      if (isOrderReviewsSchemaError(ierr)) {
        reviewRow = await upsertOrderReviewLegacyRow({
          id,
          order,
          existing,
          pr,
          sr,
          productTextIn,
          sellerTextIn,
          productReviewText,
          sellerReviewText,
          now,
          resolvedListingIdForReview,
        });
      }
      if (reviewRow) {
        // handled by legacy compatibility write
      } else
      if (ierr) {
        const code = String(ierr.code || "");
        const msg = String(ierr.message || "");
        if (code === "23503" || /foreign key|violates foreign key/i.test(msg)) {
          throw new AppError(
            503,
            `Could not link this review to the product listing (${ORDER_REVIEWS_SETUP_HINT}). If the listing was removed, run migration \`20260517120000_order_reviews_listing_nullable_fk.sql\` then NOTIFY pgrst.`,
          );
        }
        if (code === "23502" && /listing_id/i.test(msg)) {
          throw new AppError(
            503,
            "Apply migration `20260517120000_order_reviews_listing_nullable_fk.sql` so seller-only reviews save when the product listing row is missing.",
          );
        }
        throw new AppError(500, ierr.message);
      }
      reviewRow = reviewRow || inserted;
    }

    if (pr.set) {
      const hadProduct = existing?.product_rating != null;
      await notifyUserOrderEvent({
        recipientUserId: order.seller_id,
        actorUserId: req.user.id,
        orderId: id,
        recipientRole: "seller",
        title: "New product rating",
        body: hadProduct
          ? "A buyer updated their product (item) rating on a completed order."
          : "A buyer rated the product (item) on a completed order.",
        orderStatusForTab: order.status,
      });
    }
    if (sr.set) {
      const hadSeller = existing?.seller_rating != null;
      await notifyUserOrderEvent({
        recipientUserId: order.seller_id,
        actorUserId: req.user.id,
        orderId: id,
        recipientRole: "seller",
        title: "New buyer feedback",
        body: hadSeller ? "A buyer updated their seller review on your order." : "A buyer left seller feedback on your order.",
        orderStatusForTab: order.status,
      });
    }
    const hasCcDelivery = (await orderIdsWithAcceptedCommunityCourier([String(order.id)])).has(String(order.id));
    const elig = await buyerRatingEligibilityExtras(order, hasCcDelivery);
    const listingMeta = await fetchListingMetaForOrder(order);
    res.json({
      order: orderRowToApi(order, reviewRow, listingMeta, null, {
        hasCommunityCourierDelivery: hasCcDelivery,
        buyerMayRateSeller: elig.buyerMayRateSeller,
        buyerMayRateCourier: elig.buyerMayRateCourier,
      }),
      review: buyerReviewRowToApi(reviewRow),
    });
  } catch (e) {
    next(e);
  }
};

function normalizeCourierDeliveryReviewTags(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const t of arr) {
    const k = String(t || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_COURIER_DELIVERY_REVIEW_TAGS.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Resolves the accepted `courier_assignments` row for this order. Prefer `orders.accepted_courier_assignment_id`
 * when it points at an accepted assignment; otherwise fall back to lookup by `order_id` (handles missing/stale FK).
 */
async function resolveAcceptedCourierAssignmentForReview(order) {
  const orderPk = order.id;
  let assignment = null;

  const fkId = order.accepted_courier_assignment_id ?? order.accepted_bid_id ?? null;
  if (fkId) {
    const { data: row, error: err } = await supabaseAdmin.from("courier_assignments").select("*").eq("id", fkId).maybeSingle();
    if (isSchemaMissingError(err)) {
      throw new AppError(500, "Courier assignments are unavailable (apply migrations / run NOTIFY pgrst, 'reload schema';).");
    }
    if (err) throw new AppError(500, err.message);
    if (row && String(row.order_id) === String(orderPk) && String(row.status || "").toLowerCase() === "accepted") {
      assignment = row;
    }
  }

  if (!assignment) {
    const { data: rows, error: err } = await supabaseAdmin
      .from("courier_assignments")
      .select("*")
      .eq("order_id", orderPk)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (isSchemaMissingError(err)) {
      throw new AppError(500, "Courier assignments are unavailable (apply migrations / run NOTIFY pgrst, 'reload schema';).");
    }
    if (err) throw new AppError(500, err.message);
    assignment = rows?.[0] ?? null;
  }

  const assignmentId = assignment?.id ?? null;
  return { assignment, assignmentId };
}

export const upsertCourierDeliveryReview = async (req, res, next) => {
  try {
    const REVIEW_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;
    const { id } = req.params;
    const rating = Number(req.body.rating);
    const tags = normalizeCourierDeliveryReviewTags(req.body.tags);
    const abuseRaw = req.body.abuseNote != null ? String(req.body.abuseNote) : "";
    const abuseNote = abuseRaw.trim().slice(0, 500);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(400, "Rating must be between 1 and 5.");

    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!order) throw new AppError(404, "Order not found.");
    if (order.buyer_id !== req.user.id) throw new AppError(403, "Only the buyer can review this delivery.");
    if (order.status !== "completed") throw new AppError(400, "You can only review after the order is completed.");
    if (order.fulfillment_type !== "delivery") throw new AppError(400, "Courier reviews apply to delivery orders only.");

    const { assignment, assignmentId } = await resolveAcceptedCourierAssignmentForReview(order);
    if (!assignmentId || !assignment) {
      throw new AppError(400, "This order did not use a community courier — there is no courier to rate.");
    }

    const courierId = assignment.courier_id;
    if (String(courierId) === String(order.seller_id)) {
      throw new AppError(400, "When the seller delivers the order themselves, there is no separate courier to rate.");
    }
    const now = new Date().toISOString();

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("courier_delivery_reviews")
      .select("*")
      .eq("courier_assignment_id", assignmentId)
      .maybeSingle();
    if (isSchemaMissingError(exErr)) throw new AppError(500, `Courier reviews are not available (${COURIER_DELIVERY_REVIEWS_SETUP_HINT})`);
    if (exErr) throw new AppError(500, exErr.message);
    if (existing?.id && existing.rating != null) {
      const startedAt = existing.rating_started_at ?? existing.created_at ?? null;
      const deadlineMs = new Date(startedAt).getTime() + REVIEW_EDIT_WINDOW_MS;
      if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
        throw new AppError(400, "Courier rating edit window expired (72 hours).");
      }
    }

    let abuseReportedAt = existing?.abuse_reported_at ?? null;
    if (abuseNote) {
      if (!abuseReportedAt) abuseReportedAt = now;
    }

    let reviewRow;
    if (existing?.id) {
      const updatePayload = {
        rating,
        tags,
        abuse_note: abuseNote || null,
        abuse_reported_at: abuseReportedAt,
        rating_started_at: existing.rating_started_at ?? existing.created_at ?? now,
        updated_at: now,
      };
      let { data: updated, error: uerr } = await supabaseAdmin
        .from("courier_delivery_reviews")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (uerr && isCourierReviewTimerColumnMissingError(uerr)) {
        const { rating_started_at, ...updateWithoutTimer } = updatePayload;
        const retry = await supabaseAdmin
          .from("courier_delivery_reviews")
          .update(updateWithoutTimer)
          .eq("id", existing.id)
          .select("*")
          .single();
        updated = retry.data;
        uerr = retry.error;
      }
      if (isSchemaMissingError(uerr)) throw new AppError(500, `Courier reviews are not available (${COURIER_DELIVERY_REVIEWS_SETUP_HINT})`);
      if (uerr) throw new AppError(500, uerr.message);
      reviewRow = updated;
    } else {
      const insertPayload = {
        courier_assignment_id: assignmentId,
        order_id: id,
        buyer_id: order.buyer_id,
        courier_id: courierId,
        rating,
        tags,
        abuse_note: abuseNote || null,
        abuse_reported_at: abuseReportedAt,
        rating_started_at: now,
        created_at: now,
        updated_at: now,
      };
      let { data: inserted, error: ierr } = await supabaseAdmin
        .from("courier_delivery_reviews")
        .insert(insertPayload)
        .select("*")
        .single();
      if (ierr && isCourierReviewTimerColumnMissingError(ierr)) {
        const { rating_started_at, ...insertWithoutTimer } = insertPayload;
        const retry = await supabaseAdmin
          .from("courier_delivery_reviews")
          .insert(insertWithoutTimer)
          .select("*")
          .single();
        inserted = retry.data;
        ierr = retry.error;
      }
      if (isSchemaMissingError(ierr)) throw new AppError(500, `Courier reviews are not available (${COURIER_DELIVERY_REVIEWS_SETUP_HINT})`);
      if (ierr) {
        const code = String(ierr.code || "");
        const msg = String(ierr.message || "");
        if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
          throw new AppError(400, "You have already rated this courier.");
        }
        throw new AppError(500, ierr.message);
      }
      reviewRow = inserted;
    }

    const { data: revRow } = await supabaseAdmin.from("order_reviews").select("*").eq("order_id", id).maybeSingle();
    const listingMeta = await fetchListingMetaForOrder(order);
    await notifyCourierDeliveryFeedback({
      courierUserId: courierId,
      actorUserId: req.user.id,
      orderId: id,
      title: "New delivery feedback",
      body: existing?.id ? "A buyer updated their delivery rating." : "A buyer rated your delivery.",
    });
    const hasCcDelivery = true;
    const elig = await buyerRatingEligibilityExtras(order, hasCcDelivery);
    res.json({
      order: orderRowToApi(order, revRow || null, listingMeta, reviewRow, {
        hasCommunityCourierDelivery: hasCcDelivery,
        buyerMayRateSeller: elig.buyerMayRateSeller,
        buyerMayRateCourier: elig.buyerMayRateCourier,
      }),
      courierReview: buyerCourierReviewRowToApi(reviewRow),
    });
  } catch (e) {
    next(e);
  }
};

export const patchOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transition = String(req.body.transition ?? "").trim();
    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!order) throw new AppError(404, "Order not found.");
    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.seller_id === req.user.id;
    const ts = new Date().toISOString();
    let patch = { updated_at: ts };

    const { data: orderRuleListing } = await supabaseAdmin
      .from("listings")
      .select("vertical_id, categories, sub_id")
      .eq("id", order.listing_id)
      .maybeSingle();
    /** Prefer live listing row; if missing (deleted), infer service booking from persisted slot columns. */
    const orderRowLooksLikeServiceBooking = Boolean(order?.service_booking_date && order?.service_booking_time);
    const orderServiceAppointmentFlow = Boolean(
      (orderRuleListing && listingRowIsService(orderRuleListing)) ||
        (!orderRuleListing && orderRowLooksLikeServiceBooking),
    );

    if (transition === "seller_accept") {
      if (!isSeller) throw new AppError(403, "Only the seller can accept.");
      if (order.status !== "placed") throw new AppError(400, "Invalid state.");
      if (listingRowIsService(orderRuleListing)) {
        const slot = effectiveServiceSlotFromOrderRow(order);
        if (slot?.date && slot?.time) {
          const { taken } = await findConflictingServiceBooking(supabaseAdmin, {
            listingId: String(order.listing_id),
            dateIso: slot.date,
            timeHm: slot.time,
            excludeOrderId: String(order.id),
          });
          if (taken) {
            throw new AppError(
              409,
              "Another booking already holds this time slot. Decline this request or ask the buyer to reschedule.",
            );
          }
        }
      }
      patch.status = "seller_accepted";
      if (!order.processing_entered_at) patch.processing_entered_at = ts;
      if (order.fulfillment_type === "delivery") {
        const sellerAdd = parseOptionalCourierContributionCents(req.body.sellerCourierContributionCents);
        if (sellerAdd != null) {
          const b = Math.max(0, Math.floor(Number(order.buyer_courier_contribution_cents) || 0));
          patch.seller_courier_contribution_cents = sellerAdd;
          patch.cod_delivery_cents = deliveryCodTotalFromSplit(b, sellerAdd);
        }
      }
    } else if (transition === "update_courier_contributions") {
      if (order.fulfillment_type !== "delivery") throw new AppError(400, "Only delivery orders use this action.");
      if (orderHasAcceptedCommunityCourier(order)) {
        throw new AppError(400, "A courier is already assigned. The pool can’t be changed in-app; coordinate off-app or cancel if needed.");
      }
      const buyerIn = parseOptionalCourierContributionCents(req.body.buyerCourierContributionCents);
      const sellerIn = parseOptionalCourierContributionCents(req.body.sellerCourierContributionCents);
      if (buyerIn == null && sellerIn == null) {
        throw new AppError(400, "Provide buyerCourierContributionCents and/or sellerCourierContributionCents.");
      }
      let b = Math.max(0, Math.floor(Number(order.buyer_courier_contribution_cents) || 0));
      let s = Math.max(0, Math.floor(Number(order.seller_courier_contribution_cents) || 0));
      if (order.status === "placed") {
        if (!isBuyer) throw new AppError(403, "Only the buyer can update the delivery tip while the order is pending.");
        if (buyerIn == null) throw new AppError(400, "Set buyerCourierContributionCents.");
        if (sellerIn != null) throw new AppError(400, "Only the buyer’s share can change while the order is still pending.");
        b = buyerIn;
      } else if (order.status === "seller_accepted") {
        if (buyerIn != null) {
          if (!isBuyer) throw new AppError(403, "Only the buyer can change the buyer’s share.");
          b = buyerIn;
        }
        if (sellerIn != null) {
          if (!isSeller) throw new AppError(403, "Only the seller can change the seller’s share.");
          s = sellerIn;
        }
      } else {
        throw new AppError(400, "Invalid state to update courier contributions.");
      }
      patch.buyer_courier_contribution_cents = b;
      patch.seller_courier_contribution_cents = s;
      patch.cod_delivery_cents = deliveryCodTotalFromSplit(b, s);
    } else if (transition === "provider_mark_on_the_way") {
      if (!isSeller) throw new AppError(403, "Only the provider can mark on the way.");
      if (!orderServiceAppointmentFlow) {
        throw new AppError(400, "Only service bookings use this step.");
      }
      if (order.status !== "seller_accepted") throw new AppError(400, "Invalid state.");
      patch.status = "provider_on_the_way";
    } else if (transition === "mark_ready_for_pickup") {
      if (!isSeller) throw new AppError(403, "Only the seller can mark ready for pickup.");
      /**
       * Service bookings now flow `seller_accepted → provider_on_the_way → ready_for_pickup` (the
       * "Arrived" milestone reuses this transition); product pickup keeps the original one-step jump.
       */
      const allowedFromForService = ["seller_accepted", "provider_on_the_way"];
      const validState = orderServiceAppointmentFlow
        ? allowedFromForService.includes(order.status)
        : order.status === "seller_accepted";
      if (!validState) throw new AppError(400, "Invalid state.");
      const pickupOk = order.fulfillment_type === "pickup";
      const serviceDeliveryAsAppointment = order.fulfillment_type === "delivery" && orderServiceAppointmentFlow;
      if (!pickupOk && !serviceDeliveryAsAppointment) {
        throw new AppError(400, "Only pickup orders use this step.");
      }
      patch.status = "ready_for_pickup";
    } else if (transition === "mark_pickup_done") {
      if (!isSeller) throw new AppError(403, "Only the seller can mark pickup complete.");
      if (order.status !== "ready_for_pickup") throw new AppError(400, "Invalid state.");
      patch.status = "completed";
      patch.completed_at = ts;
    } else if (transition === "buyer_ack_receipt") {
      if (!isBuyer) throw new AppError(403, "Only the buyer can confirm pickup.");
      const pickupAckOk = order.fulfillment_type === "pickup";
      const serviceDeliveryAckOk = order.fulfillment_type === "delivery" && orderServiceAppointmentFlow;
      if (!pickupAckOk && !serviceDeliveryAckOk) throw new AppError(400, "Only pickup orders use this action.");
      if (order.status === "completed") {
        return res.json({ order: orderRowToApi(order) });
      }
      if (order.status !== "ready_for_pickup") throw new AppError(400, "Invalid state.");
      /** Buyer “Mark as Picked Up” completes COD pickup (inventory follows `completed` patch below). */
      patch.status = "completed";
      patch.completed_at = ts;
      patch.buyer_receipt_acknowledged_at = order.buyer_receipt_acknowledged_at || ts;
    } else if (transition === "cancel") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
      if (["completed", "cancelled"].includes(order.status)) throw new AppError(400, "Cannot cancel.");
      const rawReason = String(req.body.cancellationReason ?? req.body.cancellation_reason ?? "").trim();
      if (!ALLOWED_ORDER_CANCELLATION_REASONS.has(rawReason)) {
        throw new AppError(400, "Choose a valid cancellation reason.");
      }
      const rawNote = String(req.body.cancellationNote ?? req.body.cancellation_note ?? "").trim().slice(0, 500);
      patch.status = "cancelled";
      patch.cancelled_at = ts;
      patch.cancelled_by_role = isBuyer ? "buyer" : "seller";
      patch.cancellation_reason = rawReason;
      patch.cancellation_note = rawNote.length ? rawNote : null;
    } else if (transition === "seller_self_out_for_delivery") {
      if (!isSeller) throw new AppError(403, "Only the seller can self-deliver.");
      if (order.fulfillment_type !== "delivery") throw new AppError(400, "Only delivery orders use this action.");
      if (order.status !== "seller_accepted") throw new AppError(400, "Invalid state.");
      if (orderServiceAppointmentFlow) {
        throw new AppError(
          400,
          "This booking uses the appointment flow — mark “Ready for appointment” instead of courier-style delivery.",
        );
      }
      patch.status = "out_for_delivery";
    } else if (transition === "mark_out_for_delivery") {
      if (!isSeller) throw new AppError(403, "Only seller can mark out for delivery.");
      if (order.status !== "courier_assigned") throw new AppError(400, "Invalid state.");
      patch.status = "out_for_delivery";
    } else if (transition === "mark_delivered") {
      if (!isBuyer) throw new AppError(403, "Only the buyer can mark delivery as received.");
      if (order.status !== "out_for_delivery") throw new AppError(400, "Invalid state.");
      patch.status = "completed";
      patch.completed_at = ts;
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[patchOrder] unrecognized transition:", transition);
      }
      throw new AppError(
        400,
        "Unrecognized order action. Refresh the page, or restart the marketplace API if you are on a local dev setup.",
      );
    }

    if (transition === "seller_self_out_for_delivery") {
      const { error: bidCloseErr } = await supabaseAdmin
        .from("courier_assignments")
        .update({ status: "rejected" })
        .eq("order_id", id)
        .eq("status", "pending");
      if (bidCloseErr && process.env.NODE_ENV !== "production") {
        console.warn("[patchOrder] seller_self_out_for_delivery courier row cleanup:", bidCloseErr.message);
      }
    }

    const orderBeforePatch = order;
    const { data: updated, error: uerr } = await updateOrderRowRetryWithoutMissingColumns(id, patch);
    if (uerr) throw new AppError(500, uerr.message);
    if (patch.status === "completed") {
      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("quantity,sold_count,status,vertical_id,categories")
        .eq("id", order.listing_id)
        .maybeSingle();
      if (listing && typeof listing.quantity === "number" && !listingRowIsService(listing)) {
        const newQty = Math.max(0, listing.quantity - order.quantity);
        const soldCountBase = Math.max(0, Number(listing.sold_count) || 0);
        const nextSoldCount = soldCountBase + Math.max(0, Number(order.quantity) || 0);
        const listingIsDeleted = String(listing.status || "").toLowerCase() === "deleted";
        const listingPatch = {
          quantity: newQty,
          sold_count: nextSoldCount,
          updated_at: new Date().toISOString(),
          ...(newQty === 0 && !listingIsDeleted ? { status: "sold" } : {}),
        };
        const { error: listingUpdateErr } = await supabaseAdmin
          .from("listings")
          .update(listingPatch)
          .eq("id", order.listing_id);
        if (listingUpdateErr && isListingsSchemaCacheOrMissingColumnError(listingUpdateErr)) {
          const { sold_count, ...patchWithoutSoldCount } = listingPatch;
          await supabaseAdmin.from("listings").update(patchWithoutSoldCount).eq("id", order.listing_id);
        }
      }
    }
    /** Only collapse duplicate pending (`placed`) rows — never merge separate completed purchases of the same listing. */
    const shouldConsolidate =
      updated?.buyer_id &&
      updated?.listing_id &&
      String(updated?.status || "").toLowerCase() === "placed";
    const consolidated = shouldConsolidate
      ? await consolidateBuyerListingStatusOrders({
          buyerId: updated.buyer_id,
          listingId: updated.listing_id,
          status: updated.status,
          fulfillmentType: updated.fulfillment_type,
          preferredId: updated.id,
        })
      : updated;
    const finalOrder = consolidated || updated;
    if (finalOrder && String(finalOrder.fulfillment_type || "") === "delivery") {
      const st = String(finalOrder.status || "");
      if (st === "completed" || st === "cancelled") {
        await clearCourierBusyForOrderRow(finalOrder);
      }
    }

    const stFinal = String(finalOrder?.status || "");
    const oid = String(finalOrder.id);
    if (transition === "seller_accept") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: "Order in progress",
        body: "The seller accepted your order — it’s now being prepared.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "provider_mark_on_the_way") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: "Provider on the way",
        body: "Your provider is on the way to your booking.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "mark_ready_for_pickup") {
      /** Service bookings reuse this transition for the "Arrived" milestone — tune the copy accordingly. */
      const serviceArrived =
        orderServiceAppointmentFlow && String(orderBeforePatch?.status || "") === "provider_on_the_way";
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: serviceArrived ? "Provider arrived" : "Ready for pickup",
        body: serviceArrived
          ? "Your provider has arrived and your booking is in progress."
          : "Your order is ready for pickup.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "mark_pickup_done") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: orderServiceAppointmentFlow ? "Booking completed" : "Order completed",
        body: orderServiceAppointmentFlow
          ? "Your provider marked the booking as completed."
          : "The seller marked your pickup order as completed.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "buyer_ack_receipt") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.seller_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "seller",
        title: "Pickup confirmed",
        body: "The buyer confirmed they picked up the order.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "cancel") {
      const recipientUserId = isBuyer ? finalOrder.seller_id : finalOrder.buyer_id;
      const recipientRole = isBuyer ? "seller" : "buyer";
      await notifyUserOrderEvent({
        recipientUserId,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole,
        title: "Order cancelled",
        body: isBuyer ? "The buyer cancelled this order." : "The seller cancelled this order.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "seller_self_out_for_delivery") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: "Out for delivery",
        body: "The seller is delivering your order.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "mark_out_for_delivery") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.buyer_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "buyer",
        title: "Out for delivery",
        body: "Your order is on the way.",
        orderStatusForTab: stFinal,
      });
    } else if (transition === "mark_delivered") {
      await notifyUserOrderEvent({
        recipientUserId: finalOrder.seller_id,
        actorUserId: req.user.id,
        orderId: oid,
        recipientRole: "seller",
        title: "Delivery completed",
        body: "The buyer marked the order as received.",
        orderStatusForTab: stFinal,
      });
    }

    const listingMetaOut = await fetchListingMetaForOrder(finalOrder);
    res.json({ order: orderRowToApi(finalOrder, null, listingMetaOut) });
  } catch (e) {
    next(e);
  }
};

export const listOpenDeliveryOrders = async (req, res, next) => {
  try {
    const { data: meProf } = await supabaseAdmin.from("profiles").select("community_id").eq("id", req.user.id).maybeSingle();
    const myCommunityId = meProf?.community_id ? String(meProf.community_id) : null;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("fulfillment_type", "delivery")
      .eq("status", "seller_accepted")
      .neq("buyer_id", req.user.id)
      .neq("seller_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ orders: [] });
    if (error) throw new AppError(500, error.message);
    const rows = data || [];
    if (!myCommunityId) return res.json({ orders: [] });
    if (rows.length === 0) return res.json({ orders: [] });

    const listingIds = [...new Set(rows.map((r) => String(r?.listing_id || "")).filter(Boolean))];
    const { data: listings } = await supabaseAdmin
      .from("listings")
      .select("id, community_id, seller_id, title, image_url, image_urls")
      .in("id", listingIds);
    const listingRows = listings || [];
    const sellersNeedingCommunity = listingRows.filter((L) => !L.community_id && L.seller_id).map((L) => L.seller_id);
    let sellerCommunityById = new Map();
    if (sellersNeedingCommunity.length > 0) {
      const { data: sellerProfs } = await supabaseAdmin
        .from("profiles")
        .select("id, community_id")
        .in("id", [...new Set(sellersNeedingCommunity)]);
      sellerCommunityById = new Map(
        (sellerProfs || []).map((p) => [String(p.id), p.community_id ? String(p.community_id) : null]),
      );
    }
    const effectiveCommunity = (listingId) => {
      const L = listingRows.find((x) => String(x.id) === String(listingId));
      if (!L) return null;
      if (L.community_id) return String(L.community_id);
      const sid = L.seller_id ? String(L.seller_id) : "";
      return sid ? sellerCommunityById.get(sid) || null : null;
    };

    const filtered = rows.filter((r) => {
      const cid = effectiveCommunity(r.listing_id);
      return cid && cid === myCommunityId;
    });

    const minCourier = openDeliveryMinCourierCents();
    const visible =
      minCourier > 0
        ? filtered.filter((r) => Math.max(0, Number(r.cod_delivery_cents) || 0) >= minCourier)
        : filtered;

    const metaByListing = new Map(listingRows.map((L) => [String(L.id), L]));
    res.json({
      orders: visible.map((r) => orderRowToApi(r, null, metaByListing.get(String(r.listing_id)) || null)),
    });
  } catch (e) {
    next(e);
  }
};

/**
 * GET for couriers: pending invitations (buyer/seller suggested this courier; order still `seller_accepted`).
 */
export const listCourierInvitations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: meProf } = await supabaseAdmin.from("profiles").select("community_id").eq("id", userId).maybeSingle();
    const myCommunityId = meProf?.community_id ? String(meProf.community_id) : null;
    if (!myCommunityId) return res.json({ invitations: [] });

    let assignmentRowsInviterCols = true;
    let { data: assignments, error: aerr } = await supabaseAdmin
      .from("courier_assignments")
      .select("id, order_id, mode, created_at, invited_by_buyer, invited_by_seller")
      .eq("courier_id", userId)
      .eq("status", "pending");
    if (aerr && isMissingCourierAssignmentInviterColumnsError(aerr)) {
      assignmentRowsInviterCols = false;
      ({ data: assignments, error: aerr } = await supabaseAdmin
        .from("courier_assignments")
        .select("id, order_id, mode, created_at")
        .eq("courier_id", userId)
        .eq("status", "pending"));
    }
    if (aerr?.code === "PGRST205") return res.json({ invitations: [] });
    if (aerr) throw new AppError(500, aerr.message);
    const rows = assignments || [];
    if (rows.length === 0) return res.json({ invitations: [] });

    const orderIds = [...new Set(rows.map((r) => String(r.order_id || "")).filter(Boolean))];
    const { data: orderRows, error: oerr } = await supabaseAdmin.from("orders").select("*").in("id", orderIds);
    if (oerr) throw new AppError(500, oerr.message);
    const orderById = new Map((orderRows || []).map((o) => [String(o.id), o]));

    const listingIds = [...new Set((orderRows || []).map((r) => String(r?.listing_id || "")).filter(Boolean))];
    const { data: listings } = await supabaseAdmin
      .from("listings")
      .select("id, community_id, seller_id, title, image_url, image_urls")
      .in("id", listingIds);
    const listingRows = listings || [];
    const sellersNeedingCommunity = listingRows.filter((L) => !L.community_id && L.seller_id).map((L) => L.seller_id);
    let sellerCommunityById = new Map();
    if (sellersNeedingCommunity.length > 0) {
      const { data: sellerProfs } = await supabaseAdmin
        .from("profiles")
        .select("id, community_id")
        .in("id", [...new Set(sellersNeedingCommunity)]);
      sellerCommunityById = new Map(
        (sellerProfs || []).map((p) => [String(p.id), p.community_id ? String(p.community_id) : null]),
      );
    }
    const effectiveCommunity = (listingId) => {
      const L = listingRows.find((x) => String(x.id) === String(listingId));
      if (!L) return null;
      if (L.community_id) return String(L.community_id);
      const sid = L.seller_id ? String(L.seller_id) : "";
      return sid ? sellerCommunityById.get(sid) || null : null;
    };

    const minCourier = openDeliveryMinCourierCents();
    /** @type {{ assignmentId: string, order: ReturnType<typeof orderRowToApi>, assignmentMode: string | null, invitedByBuyer: boolean, invitedBySeller: boolean }[]} */
    const invitations = [];
    for (const a of rows) {
      const ord = orderById.get(String(a.order_id));
      if (!ord || String(ord.status) !== "seller_accepted" || ord.fulfillment_type !== "delivery") continue;
      const cid = effectiveCommunity(ord.listing_id);
      if (!cid || cid !== myCommunityId) continue;
      if (minCourier > 0 && Math.max(0, Number(ord.cod_delivery_cents) || 0) < minCourier) continue;
      const meta = listingRows.find((L) => String(L.id) === String(ord.listing_id)) || null;
      const rawMode = a.mode != null ? String(a.mode).toLowerCase().trim() : "";
      const assignmentMode = COURIER_TRANSPORT_MODES.includes(rawMode) ? rawMode : null;
      invitations.push({
        assignmentId: String(a.id),
        order: orderRowToApi(ord, null, meta),
        assignmentMode,
        invitedByBuyer: assignmentRowsInviterCols && Boolean(a.invited_by_buyer),
        invitedBySeller: assignmentRowsInviterCols && Boolean(a.invited_by_seller),
      });
    }

    invitations.sort((x, y) => String(y.order?.updatedAt || "").localeCompare(String(x.order?.updatedAt || "")));
    res.json({ invitations });
  } catch (e) {
    next(e);
  }
};

export const respondCourierInvitation = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const accept = Boolean(req.body?.accept);
    const mode = req.body?.mode ?? req.body?.courierMode;
    const userId = req.user.id;

    const { data: order, error: oerr } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (oerr) throw new AppError(500, oerr.message);
    if (!order) throw new AppError(404, "Order not found.");
    if (order.fulfillment_type !== "delivery") throw new AppError(400, "Not a delivery order.");
    if (String(order.status) !== "seller_accepted") {
      throw new AppError(400, "This order is no longer available to respond to.");
    }

    const { data: assignment, error: aerr } = await supabaseAdmin
      .from("courier_assignments")
      .select("id, courier_id, status")
      .eq("order_id", orderId)
      .eq("courier_id", userId)
      .maybeSingle();
    if (aerr) throw new AppError(500, aerr.message);
    if (!assignment || String(assignment.status) !== "pending") {
      throw new AppError(400, "No pending invitation for this order.");
    }

    if (!accept) {
      await supabaseAdmin.from("courier_assignments").update({ status: "rejected" }).eq("id", assignment.id);
      const listingMeta = await fetchListingMetaForOrder(order);
      return res.json({ order: orderRowToApi(order, null, listingMeta) });
    }

    const communityId = await resolveOrderCommunityId(order);
    if (!communityId) {
      throw new AppError(400, "This listing is not linked to a community.");
    }
    const { data: courierProfile, error: perr } = await supabaseAdmin
      .from("profiles")
      .select("community_id, courier_status")
      .eq("id", userId)
      .maybeSingle();
    if (perr) throw new AppError(500, perr.message);
    if (!courierProfile || String(courierProfile.community_id || "") !== communityId) {
      throw new AppError(403, "You must belong to the same community as this order.");
    }
    const cs = String(courierProfile.courier_status || "offline");
    if (cs === "busy") throw new AppError(400, "Finish your current delivery before accepting another.");
    if (cs !== "available" && cs !== "active") throw new AppError(400, "Set your courier status to Available or Active to accept.");

    const { data: modeRow } = await supabaseAdmin.from("profiles").select("courier_modes").eq("id", userId).maybeSingle();
    const modes = normalizeDbTextArray(modeRow?.courier_modes);
    const resolvedMode = resolveCourierAssignmentMode(modes, mode);
    await supabaseAdmin.from("courier_assignments").update({ mode: resolvedMode }).eq("id", assignment.id);

    const apiOrder = await atomicAcceptCourierAssignment(order, assignment.id, userId);
    res.json({ order: apiOrder });
  } catch (e) {
    next(e);
  }
};

/**
 * GET for couriers: the in-progress delivery (accepted assignment + order in courier_assigned / out_for_delivery).
 * Open tasks use seller_accepted only; this fills the gap when the hub shows “busy”.
 */
export const getCourierActiveDelivery = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: assignments, error: aerr } = await supabaseAdmin
      .from("courier_assignments")
      .select("order_id, mode")
      .eq("courier_id", userId)
      .eq("status", "accepted");
    if (aerr?.code === "PGRST205") return res.json({ order: null, assignmentMode: null });
    if (aerr) throw new AppError(500, aerr.message);
    const orderIds = [...new Set((assignments || []).map((a) => String(a.order_id || "")).filter(Boolean))];
    if (orderIds.length === 0) return res.json({ order: null, assignmentMode: null });

    const { data: orderRows, error: oerr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("id", orderIds)
      .in("status", ["courier_assigned", "out_for_delivery"])
      .order("updated_at", { ascending: false });
    if (oerr?.code === "PGRST205") return res.json({ order: null, assignmentMode: null });
    if (oerr) throw new AppError(500, oerr.message);
    const row = (orderRows || [])[0];
    if (!row) return res.json({ order: null, assignmentMode: null });

    const assignForOrder = (assignments || []).find((a) => String(a.order_id) === String(row.id));
    const rawMode = assignForOrder?.mode != null ? String(assignForOrder.mode).toLowerCase().trim() : "";
    const assignmentMode = COURIER_TRANSPORT_MODES.includes(rawMode) ? rawMode : null;

    const listingMeta = await fetchListingMetaForOrder(row);
    res.json({
      order: orderRowToApi(row, null, listingMeta),
      assignmentMode,
    });
  } catch (e) {
    next(e);
  }
};

export const patchCourierModes = async (req, res, next) => {
  try {
    const modes = Array.isArray(req.body.modes)
      ? req.body.modes.filter((m) => COURIER_TRANSPORT_MODES.includes(String(m)))
      : [];
    const { error } = await supabaseAdmin.from("profiles").update({ courier_modes: modes }).eq("id", req.user.id);
    if (error?.code === "PGRST204" || error?.message?.includes("courier_modes")) {
      return res.json({ modes, note: "Add courier_modes column via migration to persist." });
    }
    if (error) throw new AppError(500, error.message);
    res.json({ modes });
  } catch (e) {
    next(e);
  }
};

export const getCourierModes = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from("profiles").select("courier_modes").eq("id", req.user.id).maybeSingle();
    if (error || !data) return res.json({ modes: [] });
    res.json({ modes: data.courier_modes || [] });
  } catch (e) {
    next(e);
  }
};

/**
 * Aggregates buyer star ratings from `courier_delivery_reviews` (1–5 per completed run).
 * @param {string[]} courierIds
 * @returns {Promise<Map<string, { courierAvgRating: number | null, courierReviewCount: number }>>}
 */
async function aggregateCourierDeliveryRatingStatsByCourierId(courierIds) {
  /** @type {Map<string, { courierAvgRating: number | null, courierReviewCount: number }>} */
  const out = new Map();
  const uniq = [...new Set(courierIds.map((id) => String(id || "").trim()).filter(Boolean))];
  for (const id of uniq) {
    out.set(id, { courierAvgRating: null, courierReviewCount: 0 });
  }
  if (uniq.length === 0) return out;
  const { data: revs, error } = await supabaseAdmin
    .from("courier_delivery_reviews")
    .select("courier_id, rating")
    .in("courier_id", uniq);
  if (error) {
    if (isSchemaMissingError(error)) return out;
    return out;
  }
  /** @type {Map<string, { sum: number, n: number }>} */
  const sumN = new Map();
  for (const r of revs || []) {
    const cid = String(r.courier_id || "");
    if (!cid) continue;
    const rawR = Number(r.rating);
    if (!Number.isFinite(rawR)) continue;
    const rt = Math.max(1, Math.min(5, Math.round(rawR)));
    const x = sumN.get(cid) || { sum: 0, n: 0 };
    x.sum += rt;
    x.n += 1;
    sumN.set(cid, x);
  }
  for (const cid of uniq) {
    const x = sumN.get(cid);
    if (!x || x.n === 0) out.set(cid, { courierAvgRating: null, courierReviewCount: 0 });
    else
      out.set(cid, {
        courierAvgRating: Math.round((x.sum / x.n) * 10) / 10,
        courierReviewCount: x.n,
      });
  }
  return out;
}

/**
 * Aggregates buyer star ratings from `order_reviews` (1–5 per completed order).
 * @param {string[]} sellerIds
 * @returns {Promise<Map<string, { sellerAvgRating: number | null, sellerReviewCount: number }>>}
 */
async function aggregateSellerOrderRatingStatsBySellerId(sellerIds) {
  /** @type {Map<string, { sellerAvgRating: number | null, sellerReviewCount: number }>} */
  const out = new Map();
  const uniq = [...new Set(sellerIds.map((id) => String(id || "").trim()).filter(Boolean))];
  for (const id of uniq) {
    out.set(id, { sellerAvgRating: null, sellerReviewCount: 0 });
  }
  if (uniq.length === 0) return out;
  const { data: revs, error } = await supabaseAdmin
    .from("order_reviews")
    .select("seller_id, seller_rating")
    .in("seller_id", uniq);
  if (error) {
    if (isSchemaMissingError(error)) return out;
    return out;
  }
  /** @type {Map<string, { sum: number, n: number }>} */
  const sumN = new Map();
  for (const r of revs || []) {
    const sid = String(r.seller_id || "");
    if (!sid) continue;
    const rawR = Number(r.seller_rating);
    if (!Number.isFinite(rawR)) continue;
    const rt = Math.max(1, Math.min(5, Math.round(rawR)));
    const x = sumN.get(sid) || { sum: 0, n: 0 };
    x.sum += rt;
    x.n += 1;
    sumN.set(sid, x);
  }
  for (const sid of uniq) {
    const x = sumN.get(sid);
    if (!x || x.n === 0) out.set(sid, { sellerAvgRating: null, sellerReviewCount: 0 });
    else
      out.set(sid, {
        sellerAvgRating: Math.round((x.sum / x.n) * 10) / 10,
        sellerReviewCount: x.n,
      });
  }
  return out;
}

/**
 * Aggregates buyer star ratings from `order_reviews` per listing (1–5 per completed order).
 * @param {string[]} listingIds
 * @returns {Promise<Map<string, { listingAvgRating: number | null, listingReviewCount: number }>>}
 */
async function aggregateListingOrderRatingStatsByListingId(listingIds) {
  /** @type {Map<string, { listingAvgRating: number | null, listingReviewCount: number }>} */
  const out = new Map();
  const uniq = [...new Set(listingIds.map((id) => String(id || "").trim()).filter(Boolean))];
  for (const id of uniq) {
    out.set(id, { listingAvgRating: null, listingReviewCount: 0 });
  }
  if (uniq.length === 0) return out;
  const { data: revs, error } = await supabaseAdmin
    .from("order_reviews")
    .select("listing_id, product_rating")
    .in("listing_id", uniq);
  if (error) {
    if (isSchemaMissingError(error)) return out;
    return out;
  }
  /** @type {Map<string, { sum: number, n: number }>} */
  const sumN = new Map();
  for (const r of revs || []) {
    const lid = String(r.listing_id || "");
    if (!lid) continue;
    const rawR = Number(r.product_rating);
    if (!Number.isFinite(rawR)) continue;
    const rt = Math.max(1, Math.min(5, Math.round(rawR)));
    const x = sumN.get(lid) || { sum: 0, n: 0 };
    x.sum += rt;
    x.n += 1;
    sumN.set(lid, x);
  }
  for (const lid of uniq) {
    const x = sumN.get(lid);
    if (!x || x.n === 0) out.set(lid, { listingAvgRating: null, listingReviewCount: 0 });
    else
      out.set(lid, {
        listingAvgRating: Math.round((x.sum / x.n) * 10) / 10,
        listingReviewCount: x.n,
      });
  }
  return out;
}

function mergeListingOrderReviewStatsIntoListings(listings, statsMap) {
  return listings.map((l) => {
    const id = String(l?.id || "").trim();
    const s = statsMap.get(id) || { listingAvgRating: null, listingReviewCount: 0 };
    return {
      ...l,
      listingAvgRating: s.listingAvgRating,
      listingReviewCount: s.listingReviewCount,
    };
  });
}

async function buildCourierPresencePayload(userId) {
  let data;
  let error;
  ({ data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "courier_status, courier_optional_tags, courier_modes, courier_suggested_cents, notify_courier_open_tasks, push_notification_token, push_notification_platform",
    )
    .eq("id", userId)
    .maybeSingle());
  if (error && /notify_courier|push_notification/i.test(String(error.message || ""))) {
    ({ data, error } = await supabaseAdmin
      .from("profiles")
      .select("courier_status, courier_optional_tags, courier_modes, courier_suggested_cents")
      .eq("id", userId)
      .maybeSingle());
  }

  const defaults = () => ({
    courierStatus: "offline",
    optionalTags: [],
    modes: [],
    completedDeliveries: 0,
    badges: [],
    hasActiveDelivery: false,
    suggestedCompensationCents: null,
    allowCourierTaskNotifications: true,
    pushNotificationRegistered: false,
    pushNotificationPlatform: null,
    courierAvgRating: null,
    courierReviewCount: 0,
  });

  if (error || !data) return defaults();

  const modes = normalizeDbTextArray(data.courier_modes);
  const optionalTags = normalizeDbTextArray(data.courier_optional_tags);
  const completedMap = await countCompletedDeliveriesForCourierIds([userId]);
  const completedDeliveries = completedMap.get(userId) || 0;
  const badges = deriveCourierAchievementBadges({ completedDeliveries, optionalTags, modes });
  const onActiveRun = await courierHasInProgressDelivery(userId);
  const storedLower = String(data.courier_status ?? "offline")
    .trim()
    .toLowerCase();
  const ALLOWED_COURIER_PRESENCE = new Set(["offline", "available", "active", "busy"]);
  const storedNormalized = ALLOWED_COURIER_PRESENCE.has(storedLower) ? storedLower : "offline";
  /** DB edited out-of-band (e.g. Supabase) can leave profiles stuck `busy` with no active order; align with `clearCourierBusyForOrderRow`. */
  let courierStatus = onActiveRun ? "busy" : storedNormalized;
  if (!onActiveRun && storedNormalized === "busy") {
    await setProfileCourierStatus(userId, "available");
    courierStatus = "available";
  }
  const rawSug = data.courier_suggested_cents;
  const suggestedCompensationCents =
    rawSug != null && Number.isFinite(Number(rawSug)) ? Math.max(0, Math.floor(Number(rawSug))) : null;

  const allowCourierTaskNotifications = data.notify_courier_open_tasks !== false;
  const pushNotificationRegistered = Boolean(String(data.push_notification_token ?? "").trim());
  const pp = String(data.push_notification_platform || "").toLowerCase();
  const pushNotificationPlatform = pp === "fcm" || pp === "apns" ? pp : null;

  const ratingMap = await aggregateCourierDeliveryRatingStatsByCourierId([userId]);
  const ratingStats = ratingMap.get(userId) || { courierAvgRating: null, courierReviewCount: 0 };

  return {
    courierStatus,
    optionalTags,
    modes,
    completedDeliveries,
    badges,
    hasActiveDelivery: onActiveRun,
    suggestedCompensationCents,
    allowCourierTaskNotifications,
    pushNotificationRegistered,
    pushNotificationPlatform,
    courierAvgRating: ratingStats.courierAvgRating,
    courierReviewCount: ratingStats.courierReviewCount,
  };
}

export const getCourierPresence = async (req, res, next) => {
  try {
    res.json(await buildCourierPresencePayload(req.user.id));
  } catch (e) {
    next(e);
  }
};

/** Mirrors client `computeMarketplaceProfileReadiness` / buyer checkout gates. */
function localPhone10FromProfile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("63") && local.length >= 12) local = local.slice(2);
  if (local.startsWith("0") && local.length >= 11) local = local.slice(1);
  if (local.length > 10) local = local.slice(-10);
  return local.slice(0, 10);
}

function profileRowMeetsCourierReadiness(row) {
  if (!row || typeof row !== "object") return false;
  if (String(row.username || "").trim().length < 3) return false;
  if (localPhone10FromProfile(row.phone).length !== 10) return false;
  if (String(row.first_name || "").trim().length < 2) return false;
  if (String(row.last_name || "").trim().length < 2) return false;
  const addr = parseCommaProfileAddress(row.address || "");
  if (!String(addr.brgy || "").trim()) return false;
  if (!String(addr.city || "").trim()) return false;
  if (!String(addr.province || "").trim()) return false;
  return true;
}

export const patchCourierPresence = async (req, res, next) => {
  try {
    const b = req.body || {};
    const wantsStatus = b.courierStatus !== undefined || b.courier_status !== undefined;
    const wantsTags = b.optionalTags !== undefined || b.optional_tags !== undefined;
    const wantsSuggested =
      Object.prototype.hasOwnProperty.call(b, "suggestedCompensationCents") ||
      Object.prototype.hasOwnProperty.call(b, "suggested_compensation_cents");
    const wantsNotify = Object.prototype.hasOwnProperty.call(b, "allowCourierTaskNotifications");
    const wantsPushToken = Object.prototype.hasOwnProperty.call(b, "pushNotificationToken");
    const wantsPushPlatform = Object.prototype.hasOwnProperty.call(b, "pushNotificationPlatform");

    if (!wantsStatus && !wantsTags && !wantsSuggested && !wantsNotify && !wantsPushToken && !wantsPushPlatform) {
      throw new AppError(400, "Nothing to update.");
    }

    const patch = {};

    if (wantsTags) {
      const tagsIn = Array.isArray(b.optionalTags) ? b.optionalTags : b.optional_tags;
      const tags = Array.isArray(tagsIn)
        ? [
            ...new Set(
              tagsIn
                .map((t) => String(t || "").trim().toLowerCase())
                .filter((t) => ALLOWED_COURIER_OPTIONAL_TAGS.has(t)),
            ),
          ]
        : [];
      patch.courier_optional_tags = tags;
    }

    if (wantsStatus) {
      const onActiveRun = await courierHasInProgressDelivery(req.user.id);
      if (onActiveRun) {
        throw new AppError(400, "Finish or hand off your active delivery before changing availability.");
      }
      const rawStatus = String(b.courierStatus ?? b.courier_status ?? "").trim().toLowerCase();
      const allowed = ["offline", "available", "active"];
      if (!rawStatus || !allowed.includes(rawStatus)) {
        throw new AppError(400, "Set courierStatus to offline, available, or active. (Busy is set automatically when you accept a delivery.)");
      }
      if (rawStatus === "available" || rawStatus === "active") {
        const { data: profRow, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("username, phone, first_name, last_name, address")
          .eq("id", req.user.id)
          .maybeSingle();
        if (profErr) throw new AppError(500, profErr.message || "Failed to load profile.");
        if (!profileRowMeetsCourierReadiness(profRow)) {
          throw new AppError(
            400,
            "Complete your profile (name, phone, and barangay address) before going on as a courier.",
          );
        }
      }
      patch.courier_status = rawStatus;
    }

    if (wantsSuggested) {
      const raw = b.suggestedCompensationCents ?? b.suggested_compensation_cents;
      if (raw === null || raw === "") {
        patch.courier_suggested_cents = null;
      } else {
        const n = parseOptionalCourierContributionCents(raw);
        if (n === null) patch.courier_suggested_cents = null;
        else patch.courier_suggested_cents = n;
      }
    }

    if (wantsNotify) {
      patch.notify_courier_open_tasks = Boolean(b.allowCourierTaskNotifications);
    }
    if (wantsPushToken) {
      const raw = String(b.pushNotificationToken ?? "").trim();
      patch.push_notification_token = raw.length ? raw.slice(0, 512) : null;
      if (!raw.length) patch.push_notification_platform = null;
    }
    if (wantsPushPlatform) {
      const p = String(b.pushNotificationPlatform ?? "").trim().toLowerCase();
      let effectiveTok;
      if (wantsPushToken) {
        effectiveTok = String(patch.push_notification_token ?? "").trim();
      } else {
        const { data: profTok } = await supabaseAdmin
          .from("profiles")
          .select("push_notification_token")
          .eq("id", req.user.id)
          .maybeSingle();
        effectiveTok = String(profTok?.push_notification_token ?? "").trim();
      }
      if (!p || !effectiveTok) {
        patch.push_notification_platform = null;
      } else if (p === "fcm" || p === "apns") {
        patch.push_notification_platform = p;
      } else {
        throw new AppError(400, "pushNotificationPlatform must be fcm or apns.");
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError(400, "Nothing to update.");
    }

    let { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", req.user.id);
    if (error && (isMissingProfilesNotifyCourierColumn(error) || isMissingProfilesPushTokenColumn(error))) {
      const stripped = { ...patch };
      if (isMissingProfilesNotifyCourierColumn(error)) delete stripped.notify_courier_open_tasks;
      if (isMissingProfilesPushTokenColumn(error)) {
        delete stripped.push_notification_token;
        delete stripped.push_notification_platform;
      }
      if (Object.keys(stripped).length > 0) {
        const retry = await supabaseAdmin.from("profiles").update(stripped).eq("id", req.user.id);
        error = retry.error;
      } else {
        error = null;
      }
    }
    if (error?.code === "PGRST204" || /courier_status|courier_optional|courier_suggested/i.test(String(error?.message || ""))) {
      return res.json({
        ...(await buildCourierPresencePayload(req.user.id)),
        note: "Run DB migrations to persist courier presence or notification preferences.",
      });
    }
    if (error) throw new AppError(500, error.message);
    res.json(await buildCourierPresencePayload(req.user.id));
  } catch (e) {
    next(e);
  }
};

export const listCommunityCouriers = async (req, res, next) => {
  try {
    const communityId = String(req.params.communityId || "").trim();
    const { data: me } = await supabaseAdmin.from("profiles").select("community_id").eq("id", req.user.id).maybeSingle();
    if (String(me?.community_id || "") !== communityId) {
      throw new AppError(403, "You can only view couriers in your own community.");
    }
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, username, first_name, last_name, avatar_url, courier_status, courier_optional_tags, courier_modes, courier_suggested_cents, created_at",
      )
      .eq("community_id", communityId)
      .in("courier_status", ["available", "active"])
      .order("username", { ascending: true });
    if (error) {
      if (error.code === "PGRST204" || /courier_status|courier_optional|courier_suggested/i.test(String(error.message || ""))) {
        return res.json({ couriers: [] });
      }
      throw new AppError(500, error.message);
    }
    const base = (rows || []).map((p) => {
      const rawSug = p.courier_suggested_cents;
      const suggestedCompensationCents =
        rawSug != null && Number.isFinite(Number(rawSug)) ? Math.max(0, Math.floor(Number(rawSug))) : null;
      return {
        id: p.id,
        username: String(p.username || "").trim(),
        displayName: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || String(p.username || "").trim(),
        avatarUrl: String(p.avatar_url || "").trim() || null,
        courierStatus: p.courier_status || "offline",
        optionalTags: normalizeDbTextArray(p.courier_optional_tags),
        modes: normalizeDbTextArray(p.courier_modes),
        suggestedCompensationCents,
      };
    });
    const idList = base.map((c) => String(c.id));
    const completedMap = await countCompletedDeliveriesForCourierIds(idList);
    const ratingStatsMap = await aggregateCourierDeliveryRatingStatsByCourierId(idList);
    const couriers = base
      .map((c) => {
        const completedDeliveries = completedMap.get(String(c.id)) || 0;
        const badges = deriveCourierAchievementBadges({
          completedDeliveries,
          optionalTags: c.optionalTags,
          modes: c.modes,
        });
        const rs = ratingStatsMap.get(String(c.id)) || { courierAvgRating: null, courierReviewCount: 0 };
        return { ...c, completedDeliveries, badges, ...rs };
      })
      .sort((a, b) => {
        const ra = a.courierStatus === "active" ? 0 : 1;
        const rb = b.courierStatus === "active" ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return String(a.username || "").localeCompare(String(b.username || ""), undefined, { sensitivity: "base" });
      });
    res.json({ couriers });
  } catch (e) {
    next(e);
  }
};

/**
 * Phase 5 — community engagement: delivery counts (today / week), top courier (min rating), fastest runner (claim → completed).
 * Counts are **community delivery runs** with an **accepted** courier assignment.
 */
export const getCommunityCourierEngagement = async (req, res, next) => {
  try {
    const communityId = String(req.params.communityId || "").trim();
    const { data: me } = await supabaseAdmin.from("profiles").select("community_id").eq("id", req.user.id).maybeSingle();
    if (String(me?.community_id || "") !== communityId) {
      throw new AppError(403, "You can only view engagement for your own community.");
    }

    const now = new Date();
    const weekStartIso = utcWeekStartMondayIso(now);
    const todayStartIso = utcDayStartIso(now);
    const t = engagementThresholds();

    let completionTimestampField = "completed_at";
    let weekOrderRows = [];
    const primaryWeekOrders = await supabaseAdmin
      .from("orders")
      .select("id, listing_id, completed_at")
      .eq("status", "completed")
      .eq("fulfillment_type", "delivery")
      .gte("completed_at", weekStartIso)
      .not("completed_at", "is", null);
    if (!primaryWeekOrders.error) {
      weekOrderRows = primaryWeekOrders.data || [];
    } else if (isMissingOrdersCompletedAtColumn(primaryWeekOrders.error)) {
      completionTimestampField = "updated_at";
      const fallback = await supabaseAdmin
        .from("orders")
        .select("id, listing_id, updated_at")
        .eq("status", "completed")
        .eq("fulfillment_type", "delivery")
        .gte("updated_at", weekStartIso);
      if (fallback.error) throw new AppError(500, fallback.error.message);
      weekOrderRows = (fallback.data || []).map((row) => ({
        id: row.id,
        listing_id: row.listing_id,
        completed_at: row.updated_at,
      }));
    } else {
      throw new AppError(500, primaryWeekOrders.error.message);
    }

    const allWeekOrders = weekOrderRows || [];
    const communityByOrder = await mapOrderIdsToCommunityIds(allWeekOrders);
    const inCommunityWeek = allWeekOrders.filter((o) => communityByOrder.get(String(o.id)) === communityId);
    const inCommunityToday = inCommunityWeek.filter((o) => {
      const c = o.completed_at ? new Date(o.completed_at).getTime() : 0;
      return c >= new Date(todayStartIso).getTime();
    });

    const weekOrderIds = inCommunityWeek.map((o) => String(o.id)).filter(Boolean);
    if (weekOrderIds.length === 0) {
      return res.json({
        communityId,
        period: { weekStartsAt: weekStartIso, todayStartsAt: todayStartIso, generatedAt: now.toISOString() },
        rules: {
          minAvgRatingForTop: t.minAvgRating,
          minReviewsForTop: t.minReviews,
          fastestMinDeliveries: t.fastestMinDeliveries,
          leaderboardLimit: t.leaderboardLimit,
        },
        leaderboardToday: [],
        leaderboardWeek: [],
        topCourierOfWeek: null,
        fastestRunnerWeek: null,
        meta: {
          completionTimestampField,
          ...(completionTimestampField === "updated_at"
            ? {
                completionTimestampNote:
                  "Milestone column orders.completed_at is missing; using orders.updated_at as proxy until migrations are applied.",
              }
            : {}),
          fastestExplanation:
            "Fastest runner uses average minutes from courier assignment created_at to order completed_at (UTC), this community, this ISO week.",
          fastestRunnerPhaseNote:
            "“Fast” tag rate can augment rankings once courier_delivery_reviews volume is stable — see Phase 5 docs.",
        },
      });
    }

    const { data: assignsWeek, error: aerr } = await supabaseAdmin
      .from("courier_assignments")
      .select("courier_id, order_id, created_at")
      .in("order_id", weekOrderIds)
      .eq("status", "accepted");
    if (aerr) throw new AppError(500, aerr.message);
    const assignmentRows = assignsWeek || [];

    /** @type {Map<string, { courier_id: string, created_at: string }>} */
    const assignmentByOrderId = new Map();
    for (const a of assignmentRows) {
      const oid = String(a.order_id || "");
      if (!oid) continue;
      assignmentByOrderId.set(oid, { courier_id: String(a.courier_id || ""), created_at: String(a.created_at || "") });
    }

    const orderCompletedAt = new Map(inCommunityWeek.map((o) => [String(o.id), o.completed_at]));

    /** @type {Map<string, number>} */
    const weekCounts = new Map();
    /** @type {Map<string, number>} */
    const todayCounts = new Map();
    /** @type {Map<string, number[]>} courier -> durations minutes */
    const durationBuckets = new Map();

    for (const o of inCommunityWeek) {
      const oid = String(o.id);
      const asg = assignmentByOrderId.get(oid);
      if (!asg?.courier_id) continue;
      const cid = String(asg.courier_id);
      weekCounts.set(cid, (weekCounts.get(cid) || 0) + 1);

      const completedRaw = orderCompletedAt.get(oid);
      const completedMs = completedRaw ? new Date(completedRaw).getTime() : NaN;
      const assignedMs = asg.created_at ? new Date(asg.created_at).getTime() : NaN;
      if (Number.isFinite(completedMs) && Number.isFinite(assignedMs) && completedMs >= assignedMs) {
        const mins = (completedMs - assignedMs) / 60000;
        if (!durationBuckets.has(cid)) durationBuckets.set(cid, []);
        durationBuckets.get(cid).push(mins);
      }
    }

    for (const o of inCommunityToday) {
      const oid = String(o.id);
      const asg = assignmentByOrderId.get(oid);
      if (!asg?.courier_id) continue;
      const cid = String(asg.courier_id);
      todayCounts.set(cid, (todayCounts.get(cid) || 0) + 1);
    }

    const courierIds = [...new Set([...weekCounts.keys(), ...todayCounts.keys()])];
    /** @type {Map<string, { username: string, displayName: string, avatarUrl: string | null }>} */
    const profileByCourier = new Map();
    if (courierIds.length > 0) {
      const { data: profs, error: perr } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_url")
        .in("id", courierIds);
      if (!perr && Array.isArray(profs)) {
        for (const p of profs) {
          const id = String(p.id || "");
          if (!id) continue;
          profileByCourier.set(id, {
            username: String(p.username || "").trim(),
            displayName:
              [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || String(p.username || "").trim(),
            avatarUrl: String(p.avatar_url || "").trim() || null,
          });
        }
      }
    }

    /** @type {Map<string, { sum: number, n: number, fast: number }>} */
    const reviewAgg = new Map();
    if (courierIds.length > 0) {
      const { data: revs, error: revErr } = await supabaseAdmin
        .from("courier_delivery_reviews")
        .select("courier_id, rating, tags")
        .in("courier_id", courierIds);
      if (!revErr && Array.isArray(revs)) {
        for (const r of revs) {
          const cid = String(r.courier_id || "");
          if (!cid) continue;
          if (!reviewAgg.has(cid)) reviewAgg.set(cid, { sum: 0, n: 0, fast: 0 });
          const x = reviewAgg.get(cid);
          const rawR = Number(r.rating);
          if (!Number.isFinite(rawR)) continue;
          const rt = Math.max(1, Math.min(5, Math.round(rawR)));
          x.sum += rt;
          x.n += 1;
          const tags = Array.isArray(r.tags) ? r.tags.map((tt) => String(tt || "").toLowerCase()) : [];
          if (tags.includes("fast")) x.fast += 1;
        }
      }
    }

    const enrich = (id, count) => {
      const prof = profileByCourier.get(id) || null;
      const ra = reviewAgg.get(id);
      const avgRating = ra && ra.n > 0 ? Math.round((ra.sum / ra.n) * 10) / 10 : null;
      const reviewCount = ra?.n ?? 0;
      const fastTagRate = ra && ra.n > 0 ? Math.round((ra.fast / ra.n) * 1000) / 1000 : null;
      return {
        courierId: id,
        username: prof?.username || "",
        displayName: prof?.displayName || "",
        avatarUrl: prof?.avatarUrl ?? null,
        deliveryCount: count,
        avgRating,
        reviewCount,
        fastTagRate,
      };
    };

    const sortDesc = (a, b) => b.deliveryCount - a.deliveryCount || String(a.username || "").localeCompare(String(b.username || ""), undefined, { sensitivity: "base" });

    const leaderboardToday = [...todayCounts.entries()]
      .map(([id, n]) => enrich(id, n))
      .sort(sortDesc)
      .slice(0, t.leaderboardLimit);

    const leaderboardWeek = [...weekCounts.entries()]
      .map(([id, n]) => enrich(id, n))
      .sort(sortDesc)
      .slice(0, t.leaderboardLimit);

    /** Top courier of week: highest weekly deliveries among couriers meeting min avg rating + min reviews (global review stats). */
    let topCourierOfWeek = null;
    for (const row of leaderboardWeek) {
      if ((row.reviewCount || 0) < t.minReviews) continue;
      if (row.avgRating == null || row.avgRating < t.minAvgRating) continue;
      topCourierOfWeek = row;
      break;
    }

    /** Lowest average minutes from assignment → completed (UTC), minimum sample size per courier. */
    let fastestRunnerWeek = null;
    let bestAvg = Infinity;
    for (const cid of courierIds) {
      const arr = durationBuckets.get(cid);
      if (!arr || arr.length < t.fastestMinDeliveries) continue;
      const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
      if (avg < bestAvg) {
        bestAvg = avg;
        fastestRunnerWeek = {
          ...enrich(cid, weekCounts.get(cid) || 0),
          avgMinutesAssignedToComplete: Math.round(avg * 10) / 10,
          deliverySamplesForTiming: arr.length,
        };
      }
    }

    res.json({
      communityId,
      period: { weekStartsAt: weekStartIso, todayStartsAt: todayStartIso, generatedAt: now.toISOString() },
      rules: {
        minAvgRatingForTop: t.minAvgRating,
        minReviewsForTop: t.minReviews,
        fastestMinDeliveries: t.fastestMinDeliveries,
        leaderboardLimit: t.leaderboardLimit,
      },
      leaderboardToday,
      leaderboardWeek,
      topCourierOfWeek,
      fastestRunnerWeek,
      meta: {
        completionTimestampField,
        ...(completionTimestampField === "updated_at"
          ? {
              completionTimestampNote:
                "Milestone column orders.completed_at is missing; using orders.updated_at as proxy until migrations are applied.",
            }
          : {}),
        fastestExplanation:
          "Fastest runner uses average minutes from courier assignment created_at to order completed_at (UTC), this community, this ISO week.",
        fastestRunnerPhaseNote:
          "Compare fastTagRate once reviews stabilize; optional future: weight Fast-tagged runs.",
      },
    });
  } catch (e) {
    next(e);
  }
};

export const assignCommunityCourier = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const courierId = String(req.body.courierId || "").trim();
    if (!courierId) throw new AppError(400, "courierId is required.");
    const { data: orderRow, error: oerr } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id")
      .eq("id", orderId)
      .maybeSingle();
    if (oerr) throw new AppError(500, oerr.message);
    if (!orderRow) throw new AppError(404, "Order not found.");
    const uid = req.user.id;
    let role = "seller";
    if (orderRow.seller_id === uid) role = "seller";
    else if (orderRow.buyer_id === uid) role = "buyer";
    else throw new AppError(403, "Only the buyer or seller on this order can assign a courier.");
    const mode = req.body?.mode ?? req.body?.courierMode;
    const order = await assignCourierToOpenDeliveryOrder(orderId, courierId, req.user.id, role, { mode, invitationOnly: true });
    res.json({ order });
  } catch (e) {
    next(e);
  }
};

export const claimCommunityDelivery = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const mode = req.body?.mode ?? req.body?.courierMode;
    const order = await assignCourierToOpenDeliveryOrder(orderId, req.user.id, req.user.id, "courier", { mode, invitationOnly: false });
    res.json({ order });
  } catch (e) {
    next(e);
  }
};

export const listExpenses = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("seller_expenses")
      .select("*")
      .eq("seller_id", req.user.id)
      .order("occurred_on", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ expenses: [] });
    if (error) throw new AppError(500, error.message);
    res.json({
      expenses: (data || []).map((r) => ({
        id: r.id,
        category: r.category,
        amountCents: r.amount_cents,
        note: r.note,
        occurredOn: r.occurred_on,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    next(e);
  }
};

export const createExpense = async (req, res, next) => {
  try {
    const row = {
      seller_id: req.user.id,
      category: String(req.body.category || "general").slice(0, 64),
      amount_cents: Number(req.body.amountCents),
      note: String(req.body.note || "").slice(0, 2000),
      occurred_on: req.body.occurredOn || new Date().toISOString().slice(0, 10),
    };
    if (!Number.isFinite(row.amount_cents) || row.amount_cents < 0) throw new AppError(400, "Invalid amount.");
    const { data, error } = await supabaseAdmin.from("seller_expenses").insert(row).select("*").single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json({
      expense: {
        id: data.id,
        category: data.category,
        amountCents: data.amount_cents,
        note: data.note,
        occurredOn: data.occurred_on,
        createdAt: data.created_at,
      },
    });
  } catch (e) {
    next(e);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("seller_expenses").delete().eq("id", id).eq("seller_id", req.user.id);
    if (error) throw new AppError(500, error.message);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

function getDashboardDateRange(query = {}) {
  const preset = String(query.preset || "today").trim().toLowerCase();
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (preset === "custom") {
    const customStart = query.startDate ? new Date(query.startDate) : null;
    const customEnd = query.endDate ? new Date(query.endDate) : null;
    if (!customStart || !customEnd || Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime())) {
      throw new AppError(400, "Custom range requires valid startDate and endDate.");
    }
    start = customStart;
    end.setTime(customEnd.getTime());
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (start > end) throw new AppError(400, "startDate cannot be later than endDate.");
  return { preset, startIso: start.toISOString(), endIso: end.toISOString() };
}

function toSellerLedgerApiRow(row) {
  return {
    id: row.id,
    entryType: row.entry_type,
    source: row.source,
    amountCents: row.amount_cents || 0,
    quantityDelta: row.quantity_delta || 0,
    listingId: row.listing_id || null,
    itemName: String(row.item_name || "").trim() || null,
    category: String(row.category || "").trim() || "general",
    note: String(row.note || "").trim() || null,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export const sellerSummary = async (req, res, next) => {
  try {
    const { preset, startIso, endIso } = getDashboardDateRange(req.query || {});
    const { data: orders, error: oerr } = await supabaseAdmin
      .from("orders")
      .select("cod_goods_cents, cod_delivery_cents, status, created_at")
      .eq("seller_id", req.user.id)
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    if (oerr && !isSchemaMissingError(oerr)) throw new AppError(500, oerr.message);
    const orderRows = isSchemaMissingError(oerr) ? [] : orders || [];
    const completed = orderRows.filter((o) => o.status === "completed");
    const inAppRevenueCents = completed.reduce((s, o) => s + (o.cod_goods_cents || 0), 0);

    const { data: expenses, error: eerr } = await supabaseAdmin.from("seller_expenses").select("amount_cents").eq("seller_id", req.user.id);
    if (eerr && !isSchemaMissingError(eerr)) throw new AppError(500, eerr.message);
    const expenseRows = isSchemaMissingError(eerr) ? [] : expenses || [];
    const inAppExpenseCents = expenseRows.reduce((s, e) => s + (e.amount_cents || 0), 0);

    const { data: rangeExpenses, error: reerr } = await supabaseAdmin
      .from("seller_expenses")
      .select("id, amount_cents, category, note, occurred_on, created_at")
      .eq("seller_id", req.user.id)
      .gte("occurred_on", startIso.slice(0, 10))
      .lte("occurred_on", endIso.slice(0, 10))
      .order("occurred_on", { ascending: false });
    if (reerr && !isSchemaMissingError(reerr)) throw new AppError(500, reerr.message);

    const { data: ledger, error: lerr } = await supabaseAdmin
      .from("seller_ledger_entries")
      .select("*")
      .eq("seller_id", req.user.id)
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: false });
    if (lerr && !isSchemaMissingError(lerr)) throw new AppError(500, lerr.message);
    const ledgerRows = isSchemaMissingError(lerr) ? [] : ledger || [];
    const manualIncomeCents = ledgerRows.filter((r) => r.entry_type === "income").reduce((s, r) => s + (r.amount_cents || 0), 0);
    const manualExpenseCents = ledgerRows.filter((r) => r.entry_type === "expense").reduce((s, r) => s + (r.amount_cents || 0), 0);
    const externalStockIn = ledgerRows.filter((r) => r.entry_type === "stock_in").reduce((s, r) => s + Math.max(0, r.quantity_delta || 0), 0);
    const externalStockOut = ledgerRows.filter((r) => r.entry_type === "stock_out").reduce((s, r) => s + Math.abs(Math.min(0, r.quantity_delta || 0)), 0);

    const { data: inv, error: ierr } = await supabaseAdmin
      .from("listings")
      .select("id,quantity,title,status")
      .eq("seller_id", req.user.id);
    if (ierr && !isSchemaMissingError(ierr)) throw new AppError(500, ierr.message);
    const invRows = isSchemaMissingError(ierr) ? [] : inv || [];
    const totalStockUnits = invRows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
    const lowStockItems = invRows.filter((row) => Number(row.quantity) > 0 && Number(row.quantity) <= 5).length;
    const outOfStockItems = invRows.filter((row) => Number(row.quantity) <= 0).length;
    const totalItems = invRows.length;

    const revenueCents = inAppRevenueCents + manualIncomeCents;
    const expenseCents = inAppExpenseCents + manualExpenseCents;
    const recentExpenses = (isSchemaMissingError(reerr) ? [] : rangeExpenses || []).map((r) => ({
      id: r.id,
      kind: "expense",
      source: "in_app",
      amountCents: r.amount_cents || 0,
      quantityDelta: 0,
      category: String(r.category || "general"),
      note: String(r.note || ""),
      occurredAt: r.occurred_on,
      createdAt: r.created_at,
    }));
    const recentManual = ledgerRows.map(toSellerLedgerApiRow);
    const recentActivity = [...recentManual, ...recentExpenses]
      .sort((a, b) => String(b.occurredAt || "").localeCompare(String(a.occurredAt || "")))
      .slice(0, 20);

    res.json({
      preset,
      range: { startDate: startIso, endDate: endIso },
      revenueCents,
      expenseCents,
      profitCents: revenueCents - expenseCents,
      inAppRevenueCents,
      inAppExpenseCents,
      manualIncomeCents,
      manualExpenseCents,
      completedOrders: completed.length,
      totalItems,
      totalStockUnits,
      lowStockItems,
      outOfStockItems,
      externalStockIn,
      externalStockOut,
      inventory: invRows.map((r) => ({
        listingId: r.id,
        title: r.title,
        quantity: r.quantity,
        status: r.status,
      })),
      recentActivity,
    });
  } catch (e) {
    next(e);
  }
};

export const listSellerLedgerEntries = async (req, res, next) => {
  try {
    const { startIso, endIso } = getDashboardDateRange(req.query || {});
    const { data, error } = await supabaseAdmin
      .from("seller_ledger_entries")
      .select("*")
      .eq("seller_id", req.user.id)
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ items: [] });
    if (error) throw new AppError(500, error.message);
    res.json({ items: (data || []).map(toSellerLedgerApiRow) });
  } catch (e) {
    next(e);
  }
};

export const createSellerLedgerEntry = async (req, res, next) => {
  try {
    const entryType = String(req.body.entryType || "").trim();
    const quantityRaw = req.body.quantityDelta ?? 0;
    const quantityAbs = Math.max(0, Math.floor(Math.abs(Number(quantityRaw) || 0)));
    const signedQuantity =
      entryType === "stock_out" ? -quantityAbs : entryType === "stock_in" ? quantityAbs : Math.floor(Number(quantityRaw) || 0);
    const row = {
      seller_id: req.user.id,
      entry_type: entryType,
      source: String(req.body.source || "manual").trim() || "manual",
      amount_cents: Math.max(0, Math.floor(Number(req.body.amountCents) || 0)),
      quantity_delta: signedQuantity,
      listing_id: req.body.listingId || null,
      item_name: String(req.body.itemName || "").slice(0, 200),
      category: String(req.body.category || "general").slice(0, 64),
      note: String(req.body.note || "").slice(0, 2000),
      occurred_at: req.body.occurredAt || new Date().toISOString(),
    };
    if ((entryType === "income" || entryType === "expense") && row.amount_cents <= 0) {
      throw new AppError(400, "Amount is required for income or expense entries.");
    }
    if ((entryType === "stock_in" || entryType === "stock_out") && quantityAbs <= 0) {
      throw new AppError(400, "Quantity is required for stock entries.");
    }
    const { data, error } = await supabaseAdmin.from("seller_ledger_entries").insert(row).select("*").single();
    if (error) throw new AppError(400, error.message);
    res.status(201).json({ item: toSellerLedgerApiRow(data) });
  } catch (e) {
    next(e);
  }
};

/** Buyer star/text reviews left on completed orders — seller reads these in Profile → Feedback. */
export const listSellerBuyerFeedback = async (req, res, next) => {
  try {
    const targetSellerId = String(req.params?.sellerId || req.user?.id || "").trim();
    if (!targetSellerId) throw new AppError(400, "Seller is required.");
    // Resolve via `orders` (source of truth). `order_reviews.seller_id` is denormalized and can be
    // missing or stale; filtering only on that column hid valid reviews.
    const { data: sellerOrders, error: oerr } = await supabaseAdmin
      .from("orders")
      .select("id, listing_id, created_at, buyer_id")
      .eq("seller_id", targetSellerId)
      .eq("status", "completed");
    if (oerr?.code === "PGRST205") return res.json({ items: [] });
    if (oerr) throw new AppError(500, oerr.message);
    const completedForSeller = sellerOrders || [];
    if (completedForSeller.length === 0) return res.json({ items: [] });

    const orderIds = completedForSeller.map((o) => o.id).filter(Boolean);
    const orderById = new Map(completedForSeller.map((o) => [String(o.id), o]));

    const { data: reviews, error } = await supabaseAdmin
      .from("order_reviews")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    if (isOrderReviewsSchemaError(error)) throw new AppError(500, `Order reviews are not available (${ORDER_REVIEWS_SETUP_HINT})`);
    if (error) throw new AppError(500, error.message);
    const rows = (reviews || []).filter((rev) => rev.seller_rating != null);
    if (rows.length === 0) return res.json({ items: [] });

    const listingIds = [...new Set(completedForSeller.map((o) => o.listing_id).filter(Boolean))];
    let listingById = new Map();
    if (listingIds.length > 0) {
      const { data: listings } = await supabaseAdmin.from("listings").select("id, title").in("id", listingIds);
      listingById = new Map((listings || []).map((l) => [String(l.id), l]));
    }

    const buyerIds = [
      ...new Set(
        rows
          .map((r) => {
            const ord = orderById.get(String(r.order_id));
            return ord?.buyer_id ?? r.buyer_id;
          })
          .filter(Boolean),
      ),
    ];
    let profileById = new Map();
    if (buyerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_url")
        .in("id", buyerIds);
      profileById = new Map((profiles || []).map((p) => [String(p.id), p]));
    }

    const displayName = (p) => {
      if (!p) return "Buyer";
      const u = String(p.username || "").trim();
      if (u) return u;
      const fn = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      return fn || "Buyer";
    };

    const items = rows.map((rev) => {
      const ord = orderById.get(String(rev.order_id));
      const canonicalBuyerId = ord?.buyer_id ?? rev.buyer_id;
      const listing = ord ? listingById.get(String(ord.listing_id)) : null;
      const buyer = profileById.get(String(canonicalBuyerId));
      const username = buyer ? String(buyer.username || "").trim() : "";
      return {
        orderId: rev.order_id,
        buyerId: canonicalBuyerId,
        listingTitle: listing?.title ? String(listing.title).trim() : "Listing",
        rating: Number(rev.seller_rating) || 0,
        reviewText: String(rev.seller_review_text ?? "").trim() || null,
        reviewedAt: rev.updated_at || rev.created_at,
        buyerDisplayName: displayName(buyer),
        buyerUsername: username || null,
        buyerAvatarUrl: profileAvatarUrlFromRow(buyer),
      };
    });

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

/** Buyer star/tag reviews on completed courier runs — courier reads these in Activity → Courier (Deliver). */
export const listCourierBuyerFeedback = async (req, res, next) => {
  try {
    const { data: reviews, error } = await supabaseAdmin
      .from("courier_delivery_reviews")
      .select("*")
      .eq("courier_id", req.user.id)
      .order("created_at", { ascending: false });
    if (isSchemaMissingError(error)) throw new AppError(500, `Courier reviews are not available (${COURIER_DELIVERY_REVIEWS_SETUP_HINT})`);
    if (error) throw new AppError(500, error.message);
    const rows = reviews || [];
    if (rows.length === 0) return res.json({ items: [] });

    const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
    const { data: orders } = await supabaseAdmin.from("orders").select("id, listing_id, created_at, buyer_id").in("id", orderIds);
    const orderById = new Map((orders || []).map((o) => [String(o.id), o]));

    const listingIds = [...new Set((orders || []).map((o) => o.listing_id).filter(Boolean))];
    let listingById = new Map();
    if (listingIds.length > 0) {
      const { data: listings } = await supabaseAdmin.from("listings").select("id, title").in("id", listingIds);
      listingById = new Map((listings || []).map((l) => [String(l.id), l]));
    }

    /** Prefer `orders.buyer_id` so profile + avatar match seller flows even if `courier_delivery_reviews.buyer_id` drifted. */
    const buyerIds = [
      ...new Set(
        rows
          .map((r) => {
            const ord = orderById.get(String(r.order_id));
            return ord?.buyer_id ?? r.buyer_id;
          })
          .filter(Boolean),
      ),
    ];
    let profileById = new Map();
    if (buyerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_url")
        .in("id", buyerIds);
      profileById = new Map((profiles || []).map((p) => [String(p.id), p]));
    }

    const displayName = (p) => {
      if (!p) return "Buyer";
      const u = String(p.username || "").trim();
      if (u) return u;
      const fn = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      return fn || "Buyer";
    };

    const items = rows.map((rev) => {
      const ord = orderById.get(String(rev.order_id));
      const canonicalBuyerId = ord?.buyer_id ?? rev.buyer_id;
      const listing = ord ? listingById.get(String(ord.listing_id)) : null;
      const buyer = profileById.get(String(canonicalBuyerId));
      const username = buyer ? String(buyer.username || "").trim() : "";
      const tags = Array.isArray(rev.tags)
        ? rev.tags.map((t) => String(t || "").trim().toLowerCase()).filter(Boolean)
        : [];
      return {
        reviewId: rev.id,
        orderId: rev.order_id,
        buyerId: canonicalBuyerId,
        listingTitle: listing?.title ? String(listing.title).trim() : "Order",
        rating: Number(rev.rating) || 0,
        tags,
        reviewedAt: rev.updated_at || rev.created_at,
        buyerDisplayName: displayName(buyer),
        buyerUsername: username || null,
        buyerAvatarUrl: profileAvatarUrlFromRow(buyer),
      };
    });

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listUsersDirectory = async (req, res, next) => {
  try {
    const pageLimit = parsePositiveInt(req.query.limit, 200, 300);
    const pageOffset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
    let data = null;
    let error = null;
    const { data: communityRows, error: communitiesErr } = await supabaseAdmin.from("communities").select("*");
    const knownCommunities = communitiesErr ? [] : communityRows || [];
    ({ data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, first_name, middle_name, last_name, address, community, avatar_url, created_at")
      .order("username", { ascending: true })
      .range(pageOffset, pageOffset + pageLimit - 1));
    if (error && (error.code === "PGRST204" || /community/i.test(String(error.message || "")))) {
      ({ data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, middle_name, last_name, address, avatar_url, created_at")
        .order("username", { ascending: true })
        .range(pageOffset, pageOffset + pageLimit - 1));
    }
    if (error) throw new AppError(500, error.message);
    const mergedById = new Map();
    for (const p of data || []) {
      const id = String(p?.id || "").trim();
      if (!id) continue;
      mergedById.set(id, {
        id,
        username: String(p?.username || "").trim(),
        firstName: String(p?.first_name || "").trim(),
        middleName: String(p?.middle_name || "").trim(),
        lastName: String(p?.last_name || "").trim(),
        address: String(p?.address || "").trim(),
        community: String(p?.community || "").trim(),
        avatarUrl: String(p?.avatar_url || "").trim(),
        joinedAt: p?.created_at || null,
      });
    }

    const inferCommunityFromAddress = (address) => {
      const addr = String(address || "").trim();
      if (!addr) return "";
      const byAddressMatch = knownCommunities.find((c) => doesProfileAddressMatchCommunity(c, addr));
      if (byAddressMatch?.name) return String(byAddressMatch.name).trim();
      const firstToken = addr.split(",")[0]?.trim() || "";
      if (!firstToken) return "";
      const byNameSimilarity = knownCommunities.find((c) =>
        isLikelySameCommunityName(firstToken, String(c?.name || "").trim()),
      );
      return byNameSimilarity?.name ? String(byNameSimilarity.name).trim() : "";
    };

    const communitiesById = new Map(
      knownCommunities.map((c) => [String(c?.id || "").trim(), String(c?.name || "").trim()]).filter(([id, name]) => id && name),
    );
    const userIds = Array.from(mergedById.keys());
    const listingCommunityByUserId = new Map();
    if (userIds.length > 0) {
      const { data: listingRows, error: listingsErr } = await supabaseAdmin
        .from("listings")
        .select("seller_id,community_id,created_at")
        .in("seller_id", userIds)
        .not("community_id", "is", null)
        .order("created_at", { ascending: false });
      if (!listingsErr) {
        for (const row of listingRows || []) {
          const sellerId = String(row?.seller_id || "").trim();
          const communityId = String(row?.community_id || "").trim();
          if (!sellerId || !communityId) continue;
          if (listingCommunityByUserId.has(sellerId)) continue; // keep latest listing's community
          const communityName = communitiesById.get(communityId) || "";
          if (communityName) listingCommunityByUserId.set(sellerId, communityName);
        }
      }
    }

    const rows = Array.from(mergedById.values())
      .map((p) => ({
        id: p.id,
        username: p.username || "",
        name: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ").trim() || p.username || "Member",
        address: p.address || "",
        community: p.community || listingCommunityByUserId.get(String(p.id || "").trim()) || inferCommunityFromAddress(p.address),
        avatarUrl: p.avatarUrl || "",
        joinedAt: p.joinedAt || null,
      }))
      .sort((a, b) =>
        String(a.username || a.name || "").localeCompare(String(b.username || b.name || ""), undefined, {
          sensitivity: "base",
        }),
      )
      .slice(0, pageLimit);
    res.json({
      users: rows,
      page: {
        limit: pageLimit,
        offset: pageOffset,
        returned: rows.length,
        hasMore: rows.length === pageLimit,
      },
    });
  } catch (e) {
    next(e);
  }
};

export const listCommunities = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from("communities").select("*").order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ communities: [] });
    if (error) throw new AppError(500, error.message);
    const communities = data || [];
    const counts = await loadProfileMemberCountsByCommunity();
    res.json({
      communities: communities.map((row) => {
        const communityId = String(row.id);
        const profileCount = counts.get(communityId) ?? 0;
        return communityRowToApi(row, profileCount);
      }),
    });
  } catch (e) {
    next(e);
  }
};

export const getCommunityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: rows, error } = await supabaseAdmin.from("communities").select("*").eq("id", id).limit(1);
    const data = firstRow(rows);
    if (error?.code === "PGRST205") throw new AppError(404, "Community not found.");
    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, "Community not found.");
    const counts = await loadProfileMemberCountsByCommunity();
    const profileCount = counts.get(String(data.id)) ?? 0;
    res.json({ community: communityPublicToApi(data, profileCount) });
  } catch (e) {
    next(e);
  }
};

export const createCommunity = async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const city = String(req.body.city ?? "")
      .trim()
      .slice(0, 120);
    const province = String(req.body.province ?? "")
      .trim()
      .slice(0, 120);
    const postalCode = String(req.body.postalCode ?? req.body.postal_code ?? "")
      .trim()
      .slice(0, 32);
    if (name.length < 2 || name.length > 120) throw new AppError(400, "Community name must be 2–120 characters.");
    const address = [city, province, postalCode].filter(Boolean).join(", ").slice(0, 500);
    const googleUrl = req.body.googleUrl != null ? String(req.body.googleUrl).trim() : "";
    if (googleUrl.length > 2048) throw new AppError(400, "Google URL is too long.");

    const { data: existingRows, error: namesErr } = await supabaseAdmin.from("communities").select("*");
    if (namesErr && !isSchemaMissingError(namesErr)) throw new AppError(500, namesErr.message);
    if (!namesErr) {
      const existing = (existingRows || []).map((r) => {
        const loc = effectiveCommunityLocale(r);
        return { name: r.name, city: loc.city, province: loc.province, postal_code: loc.postalCode };
      });
      const conflict =
        city && province && postalCode
          ? findConflictingCommunity({ name, city, province, postalCode }, existing)
          : null;
      if (conflict) {
        throw new AppError(
          400,
          `A very similar community already exists (“${conflict}”). Fix the spelling or use that community.`,
        );
      }
    }

    let imageUrl = "";
    if (req.file?.buffer) {
      imageUrl = await uploadCommunityCoverImage(req.file.buffer, req.file.mimetype, req.user.id);
    }

    const row = {
      name,
      address,
      google_url: googleUrl,
      image_url: imageUrl,
      created_by: req.user.id,
    };
    let { data, error } = await supabaseAdmin.from("communities").insert(row).select("*").single();
    if (!error && data?.id && city && province && postalCode) {
      const { error: localeUpdateErr } = await supabaseAdmin
        .from("communities")
        .update({ city, province, postal_code: postalCode })
        .eq("id", data.id);
      if (!localeUpdateErr) {
        const { data: refreshedRows } = await supabaseAdmin.from("communities").select("*").eq("id", data.id).limit(1);
        const refreshed = firstRow(refreshedRows);
        if (refreshed) data = refreshed;
      }
    }
    if (error?.code === "PGRST205") {
      throw new AppError(
        500,
        "Communities table is missing from the database (or PostgREST has not reloaded). In Supabase: SQL Editor → New query → paste and run the file `supabase/migrations/20260424200000_communities.sql` from this repo. If the table already exists in Table Editor but this error continues, run `NOTIFY pgrst, 'reload schema';` in the SQL Editor (see Supabase docs: reload PostgREST schema).",
      );
    }
    if (error) throw new AppError(400, error.message);
    const counts = await loadProfileMemberCountsByCommunity();
    const profileCount = counts.get(String(data.id)) ?? 0;
    res.status(201).json({ community: communityRowToApi(data, profileCount) });
  } catch (e) {
    next(e);
  }
};

export const updateCommunity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: existingRows, error: findErr } = await supabaseAdmin.from("communities").select("*").eq("id", id).limit(1);
    const existing = firstRow(existingRows);
    if (findErr?.code === "PGRST205") throw new AppError(404, "Community not found.");
    if (findErr) throw new AppError(500, findErr.message);
    if (!existing) throw new AppError(404, "Community not found.");
    if (existing.created_by && existing.created_by !== req.user.id) {
      throw new AppError(403, "Only the creator can edit this community.");
    }

    const patch = {};
    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 120) throw new AppError(400, "Community name must be 2–120 characters.");
      patch.name = name;
    }
    if (req.body.city != null) patch.city = String(req.body.city).trim().slice(0, 120);
    if (req.body.province != null) patch.province = String(req.body.province).trim().slice(0, 120);
    if (req.body.postalCode != null || req.body.postal_code != null) {
      patch.postal_code = String(req.body.postalCode ?? req.body.postal_code).trim().slice(0, 32);
    }
    if (req.body.googleUrl != null) {
      const googleUrl = String(req.body.googleUrl).trim();
      if (googleUrl.length > 2048) throw new AppError(400, "Google URL is too long.");
      patch.google_url = googleUrl;
    }

    if (req.file?.buffer) {
      patch.image_url = await uploadCommunityCoverImage(req.file.buffer, req.file.mimetype, req.user.id);
    }

    const city = String(patch.city ?? existing.city ?? "").trim();
    const province = String(patch.province ?? existing.province ?? "").trim();
    const postalCode = String(patch.postal_code ?? existing.postal_code ?? "").trim();
    patch.address = [city, province, postalCode].filter(Boolean).join(", ").slice(0, 500);
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin.from("communities").update(patch).eq("id", id).select("*").single();
    if (error) throw new AppError(400, error.message);
    const counts = await loadProfileMemberCountsByCommunity();
    const profileCount = counts.get(String(data.id)) ?? 0;
    res.json({ community: communityRowToApi(data, profileCount) });
  } catch (e) {
    next(e);
  }
};

const ORDER_ATTENTION_TAB_KEYS = ["pending", "processing", "completed", "cancelled"];
const emptyAttentionByTab = () => ({
  pending: [],
  processing: [],
  completed: [],
  cancelled: [],
});

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Normalize order id lists for persistence (max per tab / list caps abuse). */
const normalizeOrderIdList = (arr, maxLen = 400) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const id = String(x || "").trim();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= maxLen) break;
  }
  return out;
};

const normalizeAttentionIdsByTab = (raw) => {
  const out = emptyAttentionByTab();
  if (!raw || typeof raw !== "object") return out;
  for (const k of ORDER_ATTENTION_TAB_KEYS) {
    out[k] = normalizeOrderIdList(raw[k]);
  }
  return out;
};

const normalizeAttentionSidePayload = (input) => {
  if (!input || typeof input !== "object") return null;
  const badgeRaw = input.badgeIdsByTab ?? input.badge_ids_by_tab;
  const hiRaw = input.highlightIdsByTab ?? input.highlight_ids_by_tab;
  const pendRaw = input.recentPendingIds ?? input.recent_pending_ids;
  return {
    badgeIdsByTab: normalizeAttentionIdsByTab(badgeRaw),
    highlightIdsByTab: normalizeAttentionIdsByTab(hiRaw),
    recentPendingIds: normalizeOrderIdList(Array.isArray(pendRaw) ? pendRaw : []),
  };
};

const attentionSideToApi = (row) => {
  if (!row || typeof row !== "object") return null;
  const badgeIdsByTab = normalizeAttentionIdsByTab(row.badgeIdsByTab ?? row.badge_ids_by_tab);
  const highlightIdsByTab = normalizeAttentionIdsByTab(row.highlightIdsByTab ?? row.highlight_ids_by_tab);
  const recentPendingIds = normalizeOrderIdList(
    Array.isArray(row.recentPendingIds) ? row.recentPendingIds : row.recent_pending_ids,
  );
  return { badgeIdsByTab, highlightIdsByTab, recentPendingIds };
};

export const getMeOrderAttention = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_order_attention")
      .select("buyer_attention, seller_attention")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) {
      if (isSchemaMissingError(error)) {
        return res.json({ buyer: null, seller: null, schemaMissing: true });
      }
      throw new AppError(500, error.message);
    }
    if (!data) {
      return res.json({ buyer: null, seller: null });
    }
    const buyer = attentionSideToApi(data.buyer_attention);
    const seller = attentionSideToApi(data.seller_attention);
    const hasAttentionSide = (side) => {
      if (!side) return false;
      if (side.recentPendingIds?.length) return true;
      for (const k of ORDER_ATTENTION_TAB_KEYS) {
        if ((side.badgeIdsByTab?.[k] || []).length) return true;
        if ((side.highlightIdsByTab?.[k] || []).length) return true;
      }
      return false;
    };
    res.json({
      buyer: hasAttentionSide(buyer) ? buyer : null,
      seller: hasAttentionSide(seller) ? seller : null,
    });
  } catch (e) {
    next(e);
  }
};

export const putMeOrderAttention = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const buyer = normalizeAttentionSidePayload(body.buyer);
    const seller = normalizeAttentionSidePayload(body.seller);
    if (!buyer || !seller) {
      throw new AppError(400, "Request body must include `buyer` and `seller` objects with badge/highlight queues.");
    }
    const row = {
      user_id: req.user.id,
      buyer_attention: buyer,
      seller_attention: seller,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("user_order_attention").upsert(row, { onConflict: "user_id" });
    if (error) {
      if (isSchemaMissingError(error)) {
        throw new AppError(
          503,
          "Order attention table is missing. Apply migration `supabase/migrations/20260430120000_user_order_attention.sql` in Supabase.",
        );
      }
      throw new AppError(400, error.message);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
