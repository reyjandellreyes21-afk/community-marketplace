import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { uploadCommunityCoverImage, uploadListingImage } from "../lib/communityImageStorage.js";
import { displayNameForStoragePath } from "../lib/storagePathLabel.js";
import { findConflictingCommunity, isLikelySameCommunityName } from "../lib/communityNameSimilarity.js";
import { doesProfileAddressMatchCommunity } from "../lib/profileListingCommunity.js";
import { variantSignatureFromBuyerComment } from "../lib/variantSignature.js";

/** PostgREST: table missing from API schema (migrations not applied or `NOTIFY pgrst, 'reload schema';` needed). */
const isSchemaMissingError = (error) =>
  Boolean(error) &&
  (error.code === "PGRST205" || /schema cache/i.test(String(error.message || "")));

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
  "buyer_receipt_acknowledged_at",
  "buyer_comment",
  "variant_signature",
];

function postgrestErrorText(error) {
  if (!error) return "";
  const nested =
    typeof error === "object" && error.cause ? postgrestErrorText(error.cause) : "";
  return [error.message, error.details, error.hint, nested].filter(Boolean).join(" ").trim();
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
  "sold_count",
];
const CART_LISTING_REQUIRED_SELECT =
  "id,seller_id,title,description,image_url,price_cents,quantity,status,fulfillment_modes";
const CART_LISTING_OPTIONAL_COLUMNS = [
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
  optionNameA: String(row.option_name_a ?? row.optionNameA ?? "").trim(),
  optionValuesA: normalizeDbTextArray(row.option_values_a ?? row.optionValuesA).map(String),
  optionNameB: String(row.option_name_b ?? row.optionNameB ?? "").trim(),
  optionValuesB: normalizeDbTextArray(row.option_values_b ?? row.optionValuesB).map(String),
  variants: buildVariantsArrayFromRow(row),
  orderType: String(row.order_type ?? row.orderType ?? "in_stock").trim() || "in_stock",
  processingTime: String(row.processing_time ?? row.processingTime ?? "").trim(),
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
      .select("id,username,address")
      .in("id", sellerIds);
    if (!error) {
      profileById = new Map(
        (profiles || []).map((p) => [
          String(p?.id || "").trim(),
          {
            username: String(p?.username || "").trim(),
            address: String(p?.address || "").trim(),
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
    };
  });
}

const buyerReviewRowToApi = (row) => {
  if (!row) return null;
  return {
    rating: row.rating,
    reviewText: String(row.review_text ?? "").trim() || null,
    updatedAt: row.updated_at,
  };
};

/** Snapshot fields from `listings` row (snake_case) for order responses — keeps thumbnails working without extra client fetches. */
function orderListingSnapshotFromDbRow(row) {
  if (!row) return { listingTitle: null, listingImageUrl: "", listingImageUrls: [] };
  const imageUrls = dedupeListingImageUrlsOrdered(normalizeDbImageUrls(row.image_urls)).slice(0, LISTING_IMAGE_URLS_CAP);
  const primary = String(row.image_url || "").trim() || String(imageUrls[0] || "").trim();
  return {
    listingTitle: String(row.title || "").trim() || null,
    listingImageUrl: primary,
    listingImageUrls: imageUrls.length ? imageUrls : primary ? [primary] : [],
  };
}

const orderRowToApi = (row, reviewRow = null, listingMeta = null) => ({
  id: row.id,
  listingId: row.listing_id,
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  quantity: row.quantity,
  fulfillmentType: row.fulfillment_type,
  status: row.status,
  codGoodsCents: row.cod_goods_cents,
  codDeliveryCents: row.cod_delivery_cents,
  acceptedBidId: row.accepted_bid_id,
  comment: String(row.buyer_comment ?? "").trim(),
  variantSignature: String(row.variant_signature ?? "").trim(),
  buyerReceiptAcknowledgedAt: row.buyer_receipt_acknowledged_at ?? null,
  buyerReview: buyerReviewRowToApi(reviewRow),
  processingEnteredAt: row.processing_entered_at ?? null,
  completedAt: row.completed_at ?? null,
  cancelledAt: row.cancelled_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...orderListingSnapshotFromDbRow(listingMeta),
});

const bidRowToApi = (row) => ({
  id: row.id,
  orderId: row.order_id,
  courierId: row.courier_id,
  amountCents: row.amount_cents,
  etaMinutes: row.eta_minutes,
  mode: row.mode,
  status: row.status,
  createdAt: row.created_at,
});

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
    const { categories, verticalId, subId, communityId, lat, lng, radiusKm, q: textQuery, limit, offset } = req.query;
    const pageLimit = parsePositiveInt(limit, DEFAULT_LISTINGS_LIMIT, MAX_LISTINGS_LIMIT);
    const pageOffset = Math.max(0, Math.floor(Number(offset) || 0));
    let q = supabaseAdmin
      .from("listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);
    const categoryFilter = String(categories || verticalId || "").trim();
    if (categoryFilter) q = q.eq("vertical_id", categoryFilter);
    if (subId && subId !== "all") q = q.eq("sub_id", String(subId));
    if (communityId) q = q.eq("community_id", String(communityId));
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
    const listings = await enrichListingsWithSellerProfile(rows);
    res.json({
      listings,
      page: {
        limit: pageLimit,
        offset: pageOffset,
        returned: listings.length,
        hasMore: listings.length === pageLimit,
      },
    });
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
    const [listing] = await enrichListingsWithSellerProfile([data]);
    res.json({ listing: listing || listingRowToApi(data) });
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
      option_name_a: mergedVariants.option_name_a,
      option_values_a: mergedVariants.option_values_a,
      option_name_b: mergedVariants.option_name_b,
      option_values_b: mergedVariants.option_values_b,
      order_type: orderType,
      processing_time: processingTime,
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
    } else if (req.body.imageUrls != null) {
      const imageUrls = mergePayloadListingImageUrls(
        "",
        Array.isArray(req.body.imageUrls) ? req.body.imageUrls.map((x) => String(x || "").trim()).filter(Boolean) : [],
      );
      patch.image_urls = imageUrls;
      if (imageUrls.length > 0) patch.image_url = imageUrls[0];
    } else if (req.body.imageUrl != null) {
      patch.image_url = String(req.body.imageUrl).trim();
    }
    if (req.body.orderType != null) patch.order_type = String(req.body.orderType) === "pre_order" ? "pre_order" : "in_stock";
    if (req.body.processingTime != null) patch.processing_time = String(req.body.processingTime).trim().slice(0, 120);
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
    const { error } = await supabaseAdmin.from("listings").delete().eq("id", id);
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
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ listings: [] });
    if (error) throw new AppError(500, error.message);
    res.json({ listings: (data || []).map(listingRowToApi) });
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
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean).map(listingRowToApi);
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
    out.push({
      listingId: String(row.listing_id),
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
      comment: String(row.comment || "").trim(),
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
    const maxStock = Math.max(0, Number(listing.quantity) || 0);
    if (maxStock < 1) throw new AppError(400, "Out of stock. Current stock: 0.");
    const { data: existing, error: cErr } = await supabaseAdmin
      .from("cart_items")
      .select("quantity,comment")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("variant_signature", variantSig)
      .maybeSingle();
    if (cErr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (cErr) throw new AppError(500, cErr.message);
    const prevQty = Number(existing?.quantity) || 0;
    const mergedQty = prevQty ? prevQty + addQty : addQty;
    const newQty = Math.min(mergedQty, maxStock);
    if (newQty < 1) throw new AppError(400, "Not enough stock.");
    const mergedComment = comment || String(existing?.comment || "").trim();
    const now = new Date().toISOString();
    const rowPayload = {
      user_id: req.user.id,
      listing_id: listingId,
      variant_signature: variantSig,
      quantity: newQty,
      comment: mergedComment,
      updated_at: now,
    };
    // Explicit update/insert avoids PostgREST `upsert` requiring a matching UNIQUE/PK on exactly these columns
    // (partial migrations or stale PK on `(user_id, listing_id)` otherwise trigger ON CONFLICT errors).
    let uerr = null;
    if (existing) {
      ({ error: uerr } = await supabaseAdmin
        .from("cart_items")
        .update({ quantity: newQty, comment: mergedComment, updated_at: now })
        .eq("user_id", req.user.id)
        .eq("listing_id", listingId)
        .eq("variant_signature", variantSig));
    } else {
      ({ error: uerr } = await supabaseAdmin.from("cart_items").insert(rowPayload));
      if (
        uerr &&
        /duplicate key|unique constraint/i.test(String(uerr.message || ""))
      ) {
        const { data: updatedRows, error: upErr } = await supabaseAdmin
          .from("cart_items")
          .update({ quantity: newQty, comment: mergedComment, updated_at: now })
          .eq("user_id", req.user.id)
          .eq("listing_id", listingId)
          .eq("variant_signature", variantSig)
          .select("listing_id");
        uerr = upErr;
        if (!upErr && (!updatedRows || updatedRows.length === 0)) {
          throw new AppError(
            400,
            "Cart cannot store multiple variant lines for the same listing until the database is migrated. Run the SQL that adds `cart_items.variant_signature` and primary key (user_id, listing_id, variant_signature).",
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
    const variantSig = String(req.query.variantSignature ?? "").slice(0, 512);
    const { error } = await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("variant_signature", variantSig);
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
    const variantSig = String(req.query.variantSignature ?? "").slice(0, 512);
    const newQty = req.body.quantity != null ? Number(req.body.quantity) : NaN;
    if (!Number.isFinite(newQty) || newQty < 1 || !Number.isInteger(newQty)) throw new AppError(400, "Invalid quantity.");

    const { data: row, error: rerr } = await supabaseAdmin
      .from("cart_items")
      .select("listing_id")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("variant_signature", variantSig)
      .maybeSingle();
    if (rerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (rerr) throw new AppError(500, rerr.message);
    if (!row) throw new AppError(404, "Not in cart.");

    const { data: listing, error: lerr } = await supabaseAdmin
      .from("listings")
      .select("quantity,status,seller_id")
      .eq("id", listingId)
      .maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(400, "Listing no longer available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "Invalid cart item.");
    const maxStock = Math.max(0, Number(listing.quantity) || 0);
    if (maxStock < 1) throw new AppError(400, "Out of stock. Current stock: 0.");
    const capped = Math.min(newQty, maxStock);
    if (capped < 1) throw new AppError(400, "Invalid quantity.");

    const { error: uerr } = await supabaseAdmin
      .from("cart_items")
      .update({ quantity: capped, updated_at: new Date().toISOString() })
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .eq("variant_signature", variantSig);
    if (uerr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (uerr) throw new AppError(400, uerr.message);

    const { data: rows } = await supabaseAdmin.from("cart_items").select("*").eq("user_id", req.user.id);
    const items = await enrichCartRowsForApi(rows || []);
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const listingId = String(req.body.listingId);
    const fulfillmentType = String(req.body.fulfillmentType);
    const buyerComment = String(req.body.comment || "").trim().slice(0, 2000);
    if (!["pickup", "delivery"].includes(fulfillmentType)) throw new AppError(400, "Invalid fulfillment type.");
    const quantity = req.body.quantity != null ? Number(req.body.quantity) : 1;
    if (quantity < 1) throw new AppError(400, "Invalid quantity.");
    const { data: listing, error: lerr } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "You cannot order your own listing.");
    if (!listing.fulfillment_modes?.includes(fulfillmentType)) throw new AppError(400, "This listing does not support that fulfillment option.");
    const maxStock = Math.max(0, Number(listing.quantity) || 0);
    if (quantity > maxStock) throw new AppError(400, `Not enough stock. Requested: ${quantity}, available: ${maxStock}.`);
    const codGoodsCents = listing.price_cents * quantity;
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
    const matchingPlaced = (existingPlacedOrders || []).filter(
      (o) => effectiveVariantSignatureFromOrderRow(o) === targetVariantSig,
    );
    let preferredRowId = null;
    if (matchingPlaced.length > 0) {
      const ordered = [...matchingPlaced].sort((a, b) => {
        const at = String(a?.created_at || "");
        const bt = String(b?.created_at || "");
        return at.localeCompare(bt);
      });
      const primary = ordered[0];
      const existingQtyTotal = ordered.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity) || 0), 0);
      const mergedQty = existingQtyTotal + quantity;
      const mergedBuyerComment =
        buyerComment || String(primary?.buyer_comment || "").trim();
      const patch = {
        quantity: mergedQty,
        cod_goods_cents: listing.price_cents * mergedQty,
        // Keep latest selected fulfillment option for the merged pending order.
        fulfillment_type: fulfillmentType,
        buyer_comment: mergedBuyerComment,
        variant_signature: targetVariantSig,
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
        quantity,
        fulfillment_type: fulfillmentType,
        status: initialStatus,
        cod_goods_cents: codGoodsCents,
        cod_delivery_cents: 0,
        buyer_comment: buyerComment,
        variant_signature: targetVariantSig,
      };
      let insertPayload = { ...row };
      let data = null;
      let error = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        ({ data, error } = await supabaseAdmin.from("orders").insert(insertPayload).select("*").single());
        if (!error) break;
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
    });
    if (!finalized) throw new AppError(500, "Could not finalize order.");
    res.status(201).json({ order: orderRowToApi(finalized, null, listing) });
  } catch (e) {
    next(e);
  }
};

const consolidateBuyerListingStatusOrders = async ({ buyerId, listingId, status, fulfillmentType, preferredId = null }) => {
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

  const preferred = preferredId ? items.find((r) => String(r.id) === String(preferredId)) : null;
  const anchorSig = preferred
    ? effectiveVariantSignatureFromOrderRow(preferred)
    : effectiveVariantSignatureFromOrderRow(items[0]);
  const scoped = items.filter((r) => effectiveVariantSignatureFromOrderRow(r) === anchorSig);
  if (scoped.length === 0) return null;
  if (scoped.length === 1) return scoped[0];

  const sorted = [...scoped].sort((a, b) => String(a?.created_at || "").localeCompare(String(b?.created_at || "")));
  const primary = preferred && scoped.some((r) => String(r.id) === String(preferred.id)) ? preferred : sorted[0];
  const others = sorted.filter((r) => String(r.id) !== String(primary.id));
  const totalQty = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.quantity) || 0), 0);
  const totalGoods = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.cod_goods_cents) || 0), 0);
  const totalDelivery = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.cod_delivery_cents) || 0), 0);

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
    if (orderIds.length > 0) {
      const { data: revs, error: rerr } = await supabaseAdmin.from("order_reviews").select("*").in("order_id", orderIds);
      if (!rerr && Array.isArray(revs)) {
        for (const r of revs) {
          if (r?.order_id) reviewByOrderId.set(r.order_id, r);
        }
      }
    }
    const listingIds = [...new Set(rows.map((r) => String(r?.listing_id || "")).filter(Boolean))];
    const listingById = new Map();
    if (listingIds.length > 0) {
      const { data: listings, error: lerr } = await supabaseAdmin
        .from("listings")
        .select("id, title, image_url, image_urls")
        .in("id", listingIds);
      if (!lerr && Array.isArray(listings)) {
        for (const L of listings) {
          if (L?.id) listingById.set(String(L.id), L);
        }
      }
    }
    res.json({
      orders: rows.map((row) =>
        orderRowToApi(row, reviewByOrderId.get(row.id) || null, listingById.get(String(row.listing_id)) || null),
      ),
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

export const upsertOrderReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body.rating);
    const reviewTextRaw = req.body.reviewText != null ? String(req.body.reviewText) : "";
    const reviewText = reviewTextRaw.trim().slice(0, 2000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(400, "Rating must be between 1 and 5.");

    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!order) throw new AppError(404, "Order not found.");
    if (order.buyer_id !== req.user.id) throw new AppError(403, "Only the buyer can review this order.");
    if (order.status !== "completed") throw new AppError(400, "You can only review completed orders.");

    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from("order_reviews").select("id").eq("order_id", id).maybeSingle();
    let reviewRow;
    if (existing?.id) {
      const { data: updated, error: uerr } = await supabaseAdmin
        .from("order_reviews")
        .update({ rating, review_text: reviewText || null, updated_at: now })
        .eq("order_id", id)
        .select("*")
        .single();
      if (uerr) throw new AppError(500, uerr.message);
      reviewRow = updated;
    } else {
      const { data: inserted, error: ierr } = await supabaseAdmin
        .from("order_reviews")
        .insert({
          order_id: id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          listing_id: order.listing_id,
          rating,
          review_text: reviewText || null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (ierr) throw new AppError(500, ierr.message);
      reviewRow = inserted;
    }
    res.json({ order: orderRowToApi(order, reviewRow), review: buyerReviewRowToApi(reviewRow) });
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

    if (transition === "seller_accept") {
      if (!isSeller) throw new AppError(403, "Only the seller can accept.");
      if (order.status !== "placed") throw new AppError(400, "Invalid state.");
      patch.status = order.fulfillment_type === "delivery" ? "bidding_open" : "seller_accepted";
      if (order.fulfillment_type === "pickup") patch.status = "ready_for_pickup";
      if (!order.processing_entered_at) patch.processing_entered_at = ts;
    } else if (transition === "mark_pickup_done") {
      if (!isSeller) throw new AppError(403, "Only the seller can mark pickup complete.");
      if (order.status !== "ready_for_pickup") throw new AppError(400, "Invalid state.");
      patch.status = "completed";
      patch.completed_at = ts;
    } else if (transition === "buyer_ack_receipt") {
      if (!isBuyer) throw new AppError(403, "Only the buyer can acknowledge receipt.");
      if (order.status !== "ready_for_pickup") throw new AppError(400, "Invalid state.");
      if (order.buyer_receipt_acknowledged_at) {
        return res.json({ order: orderRowToApi(order) });
      }
      patch.buyer_receipt_acknowledged_at = new Date().toISOString();
    } else if (transition === "cancel") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
      if (["completed", "cancelled"].includes(order.status)) throw new AppError(400, "Cannot cancel.");
      patch.status = "cancelled";
      patch.cancelled_at = ts;
    } else if (transition === "mark_out_for_delivery") {
      if (!isSeller) throw new AppError(403, "Only seller can mark out for delivery.");
      if (order.status !== "bid_accepted") throw new AppError(400, "Invalid state.");
      patch.status = "out_for_delivery";
    } else if (transition === "mark_delivered") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
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

    const { data: updated, error: uerr } = await updateOrderRowRetryWithoutMissingColumns(id, patch);
    if (uerr) throw new AppError(500, uerr.message);
    if (patch.status === "completed") {
      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("quantity,sold_count")
        .eq("id", order.listing_id)
        .maybeSingle();
      if (listing && typeof listing.quantity === "number") {
        const newQty = Math.max(0, listing.quantity - order.quantity);
        const soldCountBase = Math.max(0, Number(listing.sold_count) || 0);
        const nextSoldCount = soldCountBase + Math.max(0, Number(order.quantity) || 0);
        const listingPatch = {
          quantity: newQty,
          sold_count: nextSoldCount,
          updated_at: new Date().toISOString(),
          ...(newQty === 0 ? { status: "sold" } : {}),
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
    const shouldConsolidate =
      transition !== "buyer_ack_receipt" && updated?.buyer_id && updated?.listing_id && updated?.status;
    const consolidated = shouldConsolidate
      ? await consolidateBuyerListingStatusOrders({
          buyerId: updated.buyer_id,
          listingId: updated.listing_id,
          status: updated.status,
          fulfillmentType: updated.fulfillment_type,
          preferredId: updated.id,
        })
      : updated;
    res.json({ order: orderRowToApi(consolidated || updated) });
  } catch (e) {
    next(e);
  }
};

export const acceptBid = async (req, res, next) => {
  try {
    const { id: orderId, bidId } = req.params;
    const { data: order, error: oerr } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (oerr) throw new AppError(500, oerr.message);
    if (!order) throw new AppError(404, "Order not found.");
    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.seller_id === req.user.id;
    if (!isBuyer && !isSeller) throw new AppError(403, "Only buyer or seller can accept a bid.");
    if (order.status !== "bidding_open") throw new AppError(400, "Bidding is not open for this order.");
    const { data: bid, error: berr } = await supabaseAdmin.from("delivery_bids").select("*").eq("id", bidId).maybeSingle();
    if (berr) throw new AppError(500, berr.message);
    if (!bid || bid.order_id !== orderId || bid.status !== "pending") throw new AppError(404, "Bid not found.");

    await supabaseAdmin.from("delivery_bids").update({ status: "rejected" }).eq("order_id", orderId).neq("id", bidId);
    await supabaseAdmin.from("delivery_bids").update({ status: "accepted" }).eq("id", bidId);

    const bidTs = new Date().toISOString();
    const bidPatch = {
      status: "bid_accepted",
      accepted_bid_id: bidId,
      cod_delivery_cents: bid.amount_cents,
      updated_at: bidTs,
      ...(!order.processing_entered_at ? { processing_entered_at: bidTs } : {}),
    };
    const { data: updated, error: uerr } = await updateOrderRowRetryWithoutMissingColumns(orderId, bidPatch);
    if (uerr) throw new AppError(500, uerr.message);
    res.json({ order: orderRowToApi(updated) });
  } catch (e) {
    next(e);
  }
};

export const createBid = async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const amountCents = Number(req.body.amountCents);
    const etaMinutes = req.body.etaMinutes != null ? Number(req.body.etaMinutes) : null;
    const mode = String(req.body.mode || "");
    if (!["walk", "run", "bike"].includes(mode)) throw new AppError(400, "Invalid courier mode.");
    if (!Number.isFinite(amountCents) || amountCents < 1) throw new AppError(400, "Invalid bid amount.");
    const { data: order, error: oerr } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (oerr) throw new AppError(500, oerr.message);
    if (!order) throw new AppError(404, "Order not found.");
    if (order.status !== "bidding_open") throw new AppError(400, "This order is not accepting bids.");
    if (order.buyer_id === req.user.id || order.seller_id === req.user.id) {
      throw new AppError(400, "Parties to the order cannot bid on delivery.");
    }
    const row = {
      order_id: orderId,
      courier_id: req.user.id,
      amount_cents: amountCents,
      eta_minutes: etaMinutes,
      mode,
      status: "pending",
    };
    const { data, error } = await supabaseAdmin.from("delivery_bids").insert(row).select("*").single();
    if (error?.code === "23505") throw new AppError(409, "You already placed a bid on this order.");
    if (error) throw new AppError(400, error.message);
    res.status(201).json({ bid: bidRowToApi(data) });
  } catch (e) {
    next(e);
  }
};

export const listBidsForOrder = async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const { data: order } = await supabaseAdmin.from("orders").select("id,buyer_id,seller_id").eq("id", orderId).maybeSingle();
    if (!order) throw new AppError(404, "Order not found.");
    const isParty = order.buyer_id === req.user.id || order.seller_id === req.user.id;
    const { data: bidsMine } = await supabaseAdmin.from("delivery_bids").select("id").eq("order_id", orderId).eq("courier_id", req.user.id).maybeSingle();
    if (!isParty && !bidsMine) throw new AppError(403, "Forbidden.");
    const { data, error } = await supabaseAdmin.from("delivery_bids").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    if (error) throw new AppError(500, error.message);
    res.json({ bids: (data || []).map(bidRowToApi) });
  } catch (e) {
    next(e);
  }
};

export const listOpenDeliveryOrders = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("fulfillment_type", "delivery")
      .eq("status", "bidding_open")
      .neq("buyer_id", req.user.id)
      .neq("seller_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ orders: [] });
    if (error) throw new AppError(500, error.message);
    res.json({ orders: (data || []).map(orderRowToApi) });
  } catch (e) {
    next(e);
  }
};

export const listMyBids = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("delivery_bids")
      .select("*, orders:order_id (*)")
      .eq("courier_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      const { data: bids, error: e2 } = await supabaseAdmin.from("delivery_bids").select("*").eq("courier_id", req.user.id);
      if (e2) throw new AppError(500, e2.message);
      return res.json({ bids: (bids || []).map(bidRowToApi) });
    }
    res.json({ bids: (data || []).map((r) => ({ ...bidRowToApi(r), order: r.orders ? orderRowToApi(r.orders) : null })) });
  } catch (e) {
    next(e);
  }
};

export const patchCourierModes = async (req, res, next) => {
  try {
    const modes = Array.isArray(req.body.modes) ? req.body.modes.filter((m) => ["walk", "run", "bike"].includes(String(m))) : [];
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

export const sellerSummary = async (req, res, next) => {
  try {
    const { data: orders, error: oerr } = await supabaseAdmin
      .from("orders")
      .select("cod_goods_cents, cod_delivery_cents, status, created_at")
      .eq("seller_id", req.user.id);
    if (oerr && !isSchemaMissingError(oerr)) throw new AppError(500, oerr.message);
    const orderRows = isSchemaMissingError(oerr) ? [] : orders || [];
    const completed = orderRows.filter((o) => o.status === "completed");
    const revenueCents = completed.reduce((s, o) => s + (o.cod_goods_cents || 0), 0);
    const { data: expenses, error: eerr } = await supabaseAdmin.from("seller_expenses").select("amount_cents").eq("seller_id", req.user.id);
    if (eerr && !isSchemaMissingError(eerr)) throw new AppError(500, eerr.message);
    const expenseRows = isSchemaMissingError(eerr) ? [] : expenses || [];
    const expenseCents = expenseRows.reduce((s, e) => s + (e.amount_cents || 0), 0);
    const { data: inv, error: ierr } = await supabaseAdmin
      .from("listings")
      .select("id,quantity,title,status")
      .eq("seller_id", req.user.id);
    if (ierr && !isSchemaMissingError(ierr)) throw new AppError(500, ierr.message);
    const invRows = isSchemaMissingError(ierr) ? [] : inv || [];
    res.json({
      revenueCents,
      expenseCents,
      profitCents: revenueCents - expenseCents,
      completedOrders: completed.length,
      inventory: invRows.map((r) => ({
        listingId: r.id,
        title: r.title,
        quantity: r.quantity,
        status: r.status,
      })),
    });
  } catch (e) {
    next(e);
  }
};

/** Buyer star/text reviews left on completed orders — seller reads these in Profile → Feedback. */
export const listSellerBuyerFeedback = async (req, res, next) => {
  try {
    const { data: reviews, error } = await supabaseAdmin
      .from("order_reviews")
      .select("*")
      .eq("seller_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error?.code === "PGRST205") return res.json({ items: [] });
    if (error) throw new AppError(500, error.message);
    const rows = reviews || [];
    if (rows.length === 0) return res.json({ items: [] });

    const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
    const { data: orders } = await supabaseAdmin.from("orders").select("id, listing_id, created_at").in("id", orderIds);
    const orderById = new Map((orders || []).map((o) => [o.id, o]));

    const listingIds = [...new Set((orders || []).map((o) => o.listing_id).filter(Boolean))];
    let listingById = new Map();
    if (listingIds.length > 0) {
      const { data: listings } = await supabaseAdmin.from("listings").select("id, title").in("id", listingIds);
      listingById = new Map((listings || []).map((l) => [l.id, l]));
    }

    const buyerIds = [...new Set(rows.map((r) => r.buyer_id).filter(Boolean))];
    let profileById = new Map();
    if (buyerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, last_name")
        .in("id", buyerIds);
      profileById = new Map((profiles || []).map((p) => [p.id, p]));
    }

    const displayName = (p) => {
      if (!p) return "Buyer";
      const u = String(p.username || "").trim();
      if (u) return u;
      const fn = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      return fn || "Buyer";
    };

    const items = rows.map((rev) => {
      const ord = orderById.get(rev.order_id);
      const listing = ord ? listingById.get(ord.listing_id) : null;
      const buyer = profileById.get(rev.buyer_id);
      return {
        orderId: rev.order_id,
        listingTitle: listing?.title ? String(listing.title).trim() : "Listing",
        rating: Number(rev.rating) || 0,
        reviewText: String(rev.review_text ?? "").trim() || null,
        reviewedAt: rev.updated_at || rev.created_at,
        buyerDisplayName: displayName(buyer),
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
      .select("id, username, first_name, middle_name, last_name, address, community, created_at")
      .order("username", { ascending: true })
      .range(pageOffset, pageOffset + pageLimit - 1));
    if (error && (error.code === "PGRST204" || /community/i.test(String(error.message || "")))) {
      ({ data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, username, first_name, middle_name, last_name, address, created_at")
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
