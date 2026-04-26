import { body, param, query } from "express-validator";
import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { uploadCommunityCoverImage } from "../lib/communityImageStorage.js";
import { findConflictingCommunity, isLikelySameCommunityName } from "../lib/communityNameSimilarity.js";
import { doesProfileAddressMatchCommunity } from "../lib/profileListingCommunity.js";

/** PostgREST: table missing from API schema (migrations not applied or `NOTIFY pgrst, 'reload schema';` needed). */
const isSchemaMissingError = (error) =>
  Boolean(error) &&
  (error.code === "PGRST205" || /schema cache/i.test(String(error.message || "")));

const ALLOWED_LISTING_STATUSES = new Set(["active", "paused", "sold"]);
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
  categories: row.categories ?? row.vertical_id,
  verticalId: row.vertical_id,
  subId: row.sub_id,
  fulfillmentModes: row.fulfillment_modes,
  status: row.status,
  cityLabel: row.city_label,
  lat: row.lat,
  lng: row.lng,
  imageUrl: row.image_url,
  communityId: row.community_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const orderRowToApi = (row) => ({
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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

function countProfilesMatchingCommunity(communityRow, profileRows) {
  let n = 0;
  const communityName = String(communityRow?.name || "").trim().toLowerCase();
  for (const p of profileRows || []) {
    const profileCommunity = String(p?.community || "").trim().toLowerCase();
    if (
      communityName &&
      profileCommunity &&
      (profileCommunity === communityName || isLikelySameCommunityName(profileCommunity, communityName))
    ) {
      n += 1;
      continue;
    }
    if (p?.address != null && doesProfileAddressMatchCommunity(communityRow, p.address)) n += 1;
  }
  return n;
}

/** Members = profiles whose saved `address` matches the community Brgy/name + city, province, postal (strict). */
function computeCommunityMemberCountsByProfileAddress(communities, profileRows) {
  const counts = new Map();
  for (const c of communities) {
    counts.set(String(c.id), countProfilesMatchingCommunity(c, profileRows));
  }
  return counts;
}

/** Try `community` + `address`; gracefully fallback if `community` column is unavailable. */
async function loadProfilesForCommunityCounts() {
  const withCommunity = await supabaseAdmin.from("profiles").select("id, address, community");
  const profileRows = withCommunity.error ? [] : withCommunity.data || [];

  // Include auth users metadata as a fallback source so counts stay accurate
  // even when some users don't have populated profile rows yet.
  const merged = new Map();
  for (const row of profileRows) {
    const id = String(row?.id || "");
    if (!id) continue;
    merged.set(id, {
      id,
      address: String(row?.address || ""),
      community: String(row?.community || ""),
    });
  }

  try {
    const authList = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = authList?.data?.users || [];
    for (const user of users) {
      const id = String(user?.id || "");
      if (!id) continue;
      const meta = user?.user_metadata || {};
      const existing = merged.get(id);
      merged.set(id, {
        id,
        address: String(existing?.address || meta.address || ""),
        community: String(existing?.community || meta.community || ""),
      });
    }
  } catch {
    // Fallback to profile rows only when auth listing is unavailable.
  }

  return Array.from(merged.values());
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

/** Haversine km between two WGS84 points */
function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const listingsValidators = {
  list: [
    query("categories").optional().isString(),
    query("verticalId").optional().isString(),
    query("subId").optional().isString(),
    query("communityId").optional().isUUID(),
    query("lat").optional().isFloat(),
    query("lng").optional().isFloat(),
    query("radiusKm").optional().isFloat({ min: 0.5, max: 500 }),
  ],
  create: [
    body("title").isString().trim().isLength({ min: 2, max: 200 }),
    body("description").optional().isString().isLength({ max: 8000 }),
    body("priceCents").isInt({ min: 0 }),
    body("quantity").isInt({ min: 0 }),
    body("categories").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    body("verticalId").optional().isString().trim().notEmpty().isLength({ min: 1, max: 32 }),
    body().custom((_, { req }) => {
      const categories = String(req.body?.categories ?? "").trim();
      const verticalId = String(req.body?.verticalId ?? "").trim();
      if (!categories && !verticalId) throw new Error("Categories is required.");
      return true;
    }),
    body("subId").optional({ values: "null" }).isString().trim(),
    body("fulfillmentModes").optional().isArray(),
    body("cityLabel").optional().isString().trim(),
    body("lat").optional().isFloat(),
    body("lng").optional().isFloat(),
    body("imageUrl").optional().isString(),
  ],
  idParam: [param("id").isUUID()],
};

export const listListings = async (req, res, next) => {
  try {
    const { categories, verticalId, subId, communityId, lat, lng, radiusKm } = req.query;
    let q = supabaseAdmin.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false });
    const categoryFilter = String(categories || verticalId || "").trim();
    if (categoryFilter) q = q.eq("vertical_id", categoryFilter);
    if (subId && subId !== "all") q = q.eq("sub_id", String(subId));
    if (communityId) q = q.eq("community_id", String(communityId));
    const { data, error } = await q;
    if (error?.code === "PGRST205") return res.json({ listings: [] });
    if (error) throw new AppError(500, error.message);
    let rows = data || [];
    const latN = lat != null ? Number(lat) : null;
    const lngN = lng != null ? Number(lng) : null;
    const r = radiusKm != null ? Number(radiusKm) : null;
    if (latN != null && lngN != null && r != null && Number.isFinite(r)) {
      rows = rows.filter((row) => {
        const d = distanceKm(latN, lngN, row.lat, row.lng);
        return d == null || d <= r;
      });
    }
    res.json({ listings: rows.map(listingRowToApi) });
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
    res.json({ listing: listingRowToApi(data) });
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
      image_url: String(req.body.imageUrl ?? "").trim(),
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
    const { data, error } = await supabaseAdmin.from("listings").insert(row).select("*").single();
    if (error?.code === "PGRST205") {
      throw new AppError(
        500,
        "Listings table missing (products are stored here). In Supabase: SQL Editor → paste and run repo file supabase/sql_editor_all_in_one.sql → Run. Then try Publish again.",
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
    if (req.body.imageUrl != null) patch.image_url = String(req.body.imageUrl).trim();
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
    const { data, error } = await supabaseAdmin.from("listings").update(patch).eq("id", id).select("*").single();
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
  const { data: listings, error: lerr } = await supabaseAdmin
    .from("listings")
    .select("id,seller_id,title,description,image_url,price_cents,quantity,status,fulfillment_modes")
    .in("id", listingIds);
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
    out.push({
      listingId: String(row.listing_id),
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
    if (!Number.isFinite(addQty) || addQty < 1) throw new AppError(400, "Invalid quantity.");
    const { data: listing, error: lerr } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "You cannot add your own listing to the cart.");
    const maxStock = Math.max(0, Number(listing.quantity) || 0);
    if (maxStock < 1) throw new AppError(400, "Not enough stock.");
    const { data: existing, error: cErr } = await supabaseAdmin
      .from("cart_items")
      .select("quantity,comment")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
      .maybeSingle();
    if (cErr?.code === "PGRST205") throw new AppError(500, "Cart table missing.");
    if (cErr) throw new AppError(500, cErr.message);
    const prevQty = Number(existing?.quantity) || 0;
    const mergedQty = prevQty ? prevQty + addQty : addQty;
    const newQty = Math.min(mergedQty, maxStock);
    if (newQty < 1) throw new AppError(400, "Not enough stock.");
    const mergedComment = comment || String(existing?.comment || "").trim();
    const now = new Date().toISOString();
    const { error: uerr } = await supabaseAdmin.from("cart_items").upsert(
      {
        user_id: req.user.id,
        listing_id: listingId,
        quantity: newQty,
        comment: mergedComment,
        updated_at: now,
      },
      { onConflict: "user_id,listing_id" },
    );
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
    const { error } = await supabaseAdmin.from("cart_items").delete().eq("user_id", req.user.id).eq("listing_id", listingId);
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
    const newQty = req.body.quantity != null ? Number(req.body.quantity) : NaN;
    if (!Number.isFinite(newQty) || newQty < 1 || !Number.isInteger(newQty)) throw new AppError(400, "Invalid quantity.");

    const { data: row, error: rerr } = await supabaseAdmin
      .from("cart_items")
      .select("listing_id")
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId)
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
    if (maxStock < 1) throw new AppError(400, "Not enough stock.");
    const capped = Math.min(newQty, maxStock);
    if (capped < 1) throw new AppError(400, "Invalid quantity.");

    const { error: uerr } = await supabaseAdmin
      .from("cart_items")
      .update({ quantity: capped, updated_at: new Date().toISOString() })
      .eq("user_id", req.user.id)
      .eq("listing_id", listingId);
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
    if (!["pickup", "delivery"].includes(fulfillmentType)) throw new AppError(400, "Invalid fulfillment type.");
    const quantity = req.body.quantity != null ? Number(req.body.quantity) : 1;
    if (quantity < 1) throw new AppError(400, "Invalid quantity.");
    const { data: listing, error: lerr } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (lerr) throw new AppError(500, lerr.message);
    if (!listing || listing.status !== "active") throw new AppError(404, "Listing not available.");
    if (listing.seller_id === req.user.id) throw new AppError(400, "You cannot order your own listing.");
    if (!listing.fulfillment_modes?.includes(fulfillmentType)) throw new AppError(400, "This listing does not support that fulfillment option.");
    const { data: placedRows, error: perr } = await supabaseAdmin
      .from("orders")
      .select("quantity")
      .eq("listing_id", listingId)
      .eq("status", "placed");
    if (perr && perr?.code !== "PGRST205") throw new AppError(500, perr.message);
    const pendingReservedQty = (placedRows || []).reduce((sum, row) => sum + Math.max(0, Number(row?.quantity) || 0), 0);
    const availableQty = Math.max(0, (Number(listing.quantity) || 0) - pendingReservedQty);
    if (availableQty < quantity) throw new AppError(400, "Not enough stock.");
    const codGoodsCents = listing.price_cents * quantity;
    const initialStatus = "placed";
    const { data: existingPlacedOrders, error: existingErr } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("listing_id", listingId)
      .eq("buyer_id", req.user.id)
      .eq("status", initialStatus);
    if (existingErr) throw new AppError(500, existingErr.message);
    if ((existingPlacedOrders || []).length > 0) {
      const ordered = [...existingPlacedOrders].sort((a, b) => {
        const at = String(a?.created_at || "");
        const bt = String(b?.created_at || "");
        return at.localeCompare(bt);
      });
      const primary = ordered[0];
      const existingQtyTotal = ordered.reduce((sum, row) => sum + Math.max(0, Number(row?.quantity) || 0), 0);
      const mergedQty = existingQtyTotal + quantity;
      const patch = {
        quantity: mergedQty,
        cod_goods_cents: listing.price_cents * mergedQty,
        // Keep latest selected fulfillment option for the merged pending order.
        fulfillment_type: fulfillmentType,
      };
      const { data: updated, error: uerr } = await supabaseAdmin
        .from("orders")
        .update(patch)
        .eq("id", primary.id)
        .select("*")
        .single();
      if (uerr) throw new AppError(400, uerr.message);
      const duplicateIds = ordered.slice(1).map((row) => row?.id).filter(Boolean);
      if (duplicateIds.length > 0) {
        const { error: derr } = await supabaseAdmin.from("orders").delete().in("id", duplicateIds);
        if (derr) throw new AppError(500, derr.message);
      }
      return res.status(201).json({ order: orderRowToApi(updated) });
    }
    const row = {
      listing_id: listingId,
      buyer_id: req.user.id,
      seller_id: listing.seller_id,
      quantity,
      fulfillment_type: fulfillmentType,
      status: initialStatus,
      cod_goods_cents: codGoodsCents,
      cod_delivery_cents: 0,
    };
    const { data, error } = await supabaseAdmin.from("orders").insert(row).select("*").single();
    if (error?.code === "PGRST205") throw new AppError(500, "Orders table missing.");
    if (error) throw new AppError(400, error.message);
    res.status(201).json({ order: orderRowToApi(data) });
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
  if (items.length === 1) return items[0];

  const preferred = preferredId ? items.find((r) => String(r.id) === String(preferredId)) : null;
  const sorted = [...items].sort((a, b) => String(a?.created_at || "").localeCompare(String(b?.created_at || "")));
  const primary = preferred || sorted[0];
  const others = sorted.filter((r) => String(r.id) !== String(primary.id));
  const totalQty = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.quantity) || 0), 0);
  const totalGoods = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.cod_goods_cents) || 0), 0);
  const totalDelivery = sorted.reduce((sum, r) => sum + Math.max(0, Number(r?.cod_delivery_cents) || 0), 0);

  const patch = {
    quantity: totalQty,
    cod_goods_cents: totalGoods,
    cod_delivery_cents: totalDelivery,
  };
  const { data: updated, error: uerr } = await supabaseAdmin.from("orders").update(patch).eq("id", primary.id).select("*").single();
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
    let q = supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
    if (role === "seller") q = q.eq("seller_id", req.user.id);
    else q = q.eq("buyer_id", req.user.id);
    const { data, error } = await q;
    if (error?.code === "PGRST205") return res.json({ orders: [] });
    if (error) throw new AppError(500, error.message);
    res.json({ orders: (data || []).map(orderRowToApi) });
  } catch (e) {
    next(e);
  }
};

export const patchOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transition = String(req.body.transition || "");
    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!order) throw new AppError(404, "Order not found.");
    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.seller_id === req.user.id;
    let patch = { updated_at: new Date().toISOString() };

    if (transition === "seller_accept") {
      if (!isSeller) throw new AppError(403, "Only the seller can accept.");
      if (order.status !== "placed") throw new AppError(400, "Invalid state.");
      patch.status = order.fulfillment_type === "delivery" ? "bidding_open" : "seller_accepted";
      if (order.fulfillment_type === "pickup") patch.status = "ready_for_pickup";
    } else if (transition === "mark_pickup_done") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
      if (order.status !== "ready_for_pickup") throw new AppError(400, "Invalid state.");
      patch.status = "completed";
    } else if (transition === "cancel") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
      if (["completed", "cancelled"].includes(order.status)) throw new AppError(400, "Cannot cancel.");
      patch.status = "cancelled";
    } else if (transition === "mark_out_for_delivery") {
      if (!isSeller) throw new AppError(403, "Only seller can mark out for delivery.");
      if (order.status !== "bid_accepted") throw new AppError(400, "Invalid state.");
      patch.status = "out_for_delivery";
    } else if (transition === "mark_delivered") {
      if (!isBuyer && !isSeller) throw new AppError(403, "Forbidden.");
      if (order.status !== "out_for_delivery") throw new AppError(400, "Invalid state.");
      patch.status = "completed";
    } else {
      throw new AppError(400, "Unknown transition.");
    }

    const { data: updated, error: uerr } = await supabaseAdmin.from("orders").update(patch).eq("id", id).select("*").single();
    if (uerr) throw new AppError(500, uerr.message);
    if (patch.status === "completed") {
      const { data: listing } = await supabaseAdmin.from("listings").select("quantity").eq("id", order.listing_id).maybeSingle();
      if (listing && typeof listing.quantity === "number") {
        const newQty = Math.max(0, listing.quantity - order.quantity);
        const listingPatch = {
          quantity: newQty,
          updated_at: new Date().toISOString(),
          ...(newQty === 0 ? { status: "sold" } : {}),
        };
        await supabaseAdmin.from("listings").update(listingPatch).eq("id", order.listing_id);
      }
    }
    const consolidated =
      updated?.buyer_id && updated?.listing_id && updated?.status
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

    const { data: updated, error: uerr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "bid_accepted",
        accepted_bid_id: bidId,
        cod_delivery_cents: bid.amount_cents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("*")
      .single();
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

export const listUsersDirectory = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, first_name, middle_name, last_name, created_at")
      .order("username", { ascending: true })
      .limit(200);
    if (error) throw new AppError(500, error.message);
    const rows = (data || []).map((p) => ({
      id: p.id,
      username: p.username || "",
      name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ").trim() || p.username || "Member",
      joinedAt: p.created_at || null,
    }));
    res.json({ users: rows });
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
    const profiles = await loadProfilesForCommunityCounts();
    const counts = computeCommunityMemberCountsByProfileAddress(communities, profiles);
    const sellerCounts = await loadActiveSellerCountsByCommunity();
    res.json({
      communities: communities.map((row) => {
        const communityId = String(row.id);
        const profileCount = counts.get(communityId) ?? 0;
        const sellerCount = sellerCounts.get(communityId) ?? 0;
        return communityRowToApi(row, Math.max(profileCount, sellerCount));
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
    const profiles = await loadProfilesForCommunityCounts();
    const sellerCounts = await loadActiveSellerCountsByCommunity();
    const profileCount = countProfilesMatchingCommunity(data, profiles);
    const sellerCount = sellerCounts.get(String(data.id)) ?? 0;
    res.json({ community: communityPublicToApi(data, Math.max(profileCount, sellerCount)) });
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
    const profiles = await loadProfilesForCommunityCounts();
    const sellerCounts = await loadActiveSellerCountsByCommunity();
    const profileCount = countProfilesMatchingCommunity(data, profiles);
    const sellerCount = sellerCounts.get(String(data.id)) ?? 0;
    res.status(201).json({ community: communityRowToApi(data, Math.max(profileCount, sellerCount)) });
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
    const profiles = await loadProfilesForCommunityCounts();
    const sellerCounts = await loadActiveSellerCountsByCommunity();
    const profileCount = countProfilesMatchingCommunity(data, profiles);
    const sellerCount = sellerCounts.get(String(data.id)) ?? 0;
    res.json({ community: communityRowToApi(data, Math.max(profileCount, sellerCount)) });
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
