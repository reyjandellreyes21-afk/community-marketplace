/**
 * Resolve the primary cover image URL for a listing-like object (API row, cart line, order snapshot).
 */
export function resolveListingCoverImageUrl(listing) {
  if (!listing || typeof listing !== "object") return "";
  const fromGallery = Array.isArray(listing.imageUrls) ? String(listing.imageUrls[0] || "").trim() : "";
  const primary = String(listing.imageUrl || "").trim();
  return fromGallery || primary;
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
  return {
    ...L,
    id: L.id || o.listingId,
    title,
    imageUrl,
    imageUrls,
  };
}
