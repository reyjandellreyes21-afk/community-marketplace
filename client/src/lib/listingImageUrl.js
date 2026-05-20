/**
 * Max photos per listing — matches server multipart (`images` × 6) and marketplace POST/PATCH caps.
 */
export const LISTING_MAX_IMAGES = 6;

/**
 * Resolve the primary cover image URL for a listing-like object (API row, cart line, order snapshot).
 */
export function resolveListingCoverImageUrl(listing) {
  if (!listing || typeof listing !== "object") return "";
  const galleryFirst = resolveListingGalleryUrls(listing);
  const primary = String(listing.imageUrl || listing.image_url || "").trim();
  return String(galleryFirst[0] || "").trim() || primary;
}

/** Client-side: DB/API may expose `image_urls` as array, JSON string, or a single URL string. */
function normalizeExtraImageUrls(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    return [t];
  }
  return [];
}

/** Ordered unique gallery URLs (primary + extras), capped at {@link LISTING_MAX_IMAGES}. */
export function resolveListingGalleryUrls(listing) {
  if (!listing || typeof listing !== "object") return [];
  const primary = String(listing.imageUrl || listing.image_url || "").trim();
  const extrasCamel = normalizeExtraImageUrls(listing.imageUrls);
  const extrasSnake = normalizeExtraImageUrls(listing.image_urls);
  const extras = [...extrasCamel, ...extrasSnake];
  const seen = new Set();
  const out = [];
  const push = (u) => {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(primary);
  for (const u of extras) push(u);
  return out.slice(0, LISTING_MAX_IMAGES);
}

/**
 * Merge `/orders` listing snapshot fields with an optional fetched listing (batch detail).
 */
export function enrichListingSnapshotForOrderCard(order, listing) {
  const o = order || {};
  const L = listing || {};
  const snapUrl = String(o.listingImageUrl || "").trim();
  const snapUrls = Array.isArray(o.listingImageUrls) ? o.listingImageUrls : [];
  const fromListingUrl = resolveListingCoverImageUrl(L);
  const imageUrl = fromListingUrl || snapUrl || "";
  const imageUrls =
    Array.isArray(L.imageUrls) && L.imageUrls.length ? L.imageUrls : snapUrls.length ? snapUrls : imageUrl ? [imageUrl] : [];
  const title =
    String(L.title || o.listingTitle || "").trim() ||
    (o.id ? `Order ${String(o.id).slice(0, 8)}` : "Product");
  const imageFocalRects =
    Array.isArray(L.imageFocalRects) && L.imageFocalRects.length
      ? L.imageFocalRects
      : Array.isArray(o.listingImageFocalRects)
        ? o.listingImageFocalRects
        : [];
  return {
    ...L,
    id: L.id || o.listingId,
    title,
    imageUrl,
    imageUrls,
    imageFocalRects,
  };
}
