import { LISTING_MAX_IMAGES } from "./listingImageUrl.js";

/** Default square selection: largest centered square on the short edge. */
export const DEFAULT_LISTING_FOCAL_RECT = Object.freeze({
  cropLeft: 0,
  cropTop: 0,
  cropSize: 1,
});

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/**
 * @param {unknown} raw
 * @returns {{ cropLeft: number, cropTop: number, cropSize: number } | null}
 */
export function normalizeListingFocalRect(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const cropLeft = clamp01(raw.cropLeft);
  const cropTop = clamp01(raw.cropTop);
  const cropSize = Math.min(1, Math.max(0.2, Number(raw.cropSize) || 1));
  return { cropLeft, cropTop, cropSize };
}

/** API/DB may expose `imageFocalRects` / `image_focal_rects` as array or JSON string. */
export function resolveListingImageFocalRects(listing) {
  if (!listing || typeof listing !== "object") return [];
  let raw = listing.imageFocalRects ?? listing.image_focal_rects ?? [];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        raw = parsed;
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => normalizeListingFocalRect(x)).filter(Boolean);
}

/**
 * Focal rect aligned to gallery index (same order as {@link resolveListingGalleryUrls}).
 * @param {object} listing
 * @param {number} galleryIndex
 */
export function focalRectForGalleryIndex(listing, galleryIndex) {
  const idx = Math.max(0, Math.floor(Number(galleryIndex) || 0));
  const rects = resolveListingImageFocalRects(listing);
  return normalizeListingFocalRect(rects[idx]) || null;
}

/**
 * CSS `object-position` for `object-fit: cover` in a square frame.
 * @param {{ cropLeft: number, cropTop: number, cropSize: number } | null} focal
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 */
export function focalRectToObjectPosition(focal, naturalWidth, naturalHeight) {
  const f = normalizeListingFocalRect(focal);
  if (!f) return null;
  const w = Math.max(1, Number(naturalWidth) || 1);
  const h = Math.max(1, Number(naturalHeight) || 1);
  const side = Math.max(1, Math.floor(Math.min(w, h) * f.cropSize));
  const leftMax = Math.max(0, w - side);
  const topMax = Math.max(0, h - side);
  const sx = Math.min(leftMax, Math.max(0, Math.round(f.cropLeft * w)));
  const sy = Math.min(topMax, Math.max(0, Math.round(f.cropTop * h)));
  const centerX = ((sx + side / 2) / w) * 100;
  const centerY = ((sy + side / 2) / h) * 100;
  return `${centerX.toFixed(2)}% ${centerY.toFixed(2)}%`;
}

/**
 * Build payload array parallel to uploaded image URLs (cover first).
 * @param {{ cropLeft: number, cropTop: number, cropSize: number } | null} coverFocal
 * @param {Array<{ focal?: object }>} extraItems
 * @param {number} urlCount
 */
export function buildListingImageFocalRectsPayload(coverFocal, extraItems, urlCount) {
  const n = Math.min(LISTING_MAX_IMAGES, Math.max(0, Number(urlCount) || 0));
  const out = [];
  const cover = normalizeListingFocalRect(coverFocal);
  if (n > 0) out.push(cover || DEFAULT_LISTING_FOCAL_RECT);
  const extras = Array.isArray(extraItems) ? extraItems : [];
  for (let i = 1; i < n; i++) {
    const focal = normalizeListingFocalRect(extras[i - 1]?.focal);
    out.push(focal || DEFAULT_LISTING_FOCAL_RECT);
  }
  return out;
}
