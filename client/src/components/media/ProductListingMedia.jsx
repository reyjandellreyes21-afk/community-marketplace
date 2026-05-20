import { cn } from "../../lib/cn.js";
import { focalRectForGalleryIndex } from "../../lib/listingImageFocal.js";
import { resolveListingCoverImageUrl } from "../../lib/listingImageUrl.js";
import { StableMediaImage } from "./StableMediaImage.jsx";

/**
 * Global product image frame + StableMediaImage — use for shop grids, cart thumbs, orders, seller cards.
 * @param {"grid"|"list"} variant — grid: square hero; list: square thumb sized by `className`
 * @param {boolean} feed — mobile marketplace feed: flush top + `lm-product-card-media`
 * @param {boolean} softChrome — softer ring (browse) via `lm-product-media--soft`
 * @param {boolean} fillFrame — skip fixed aspect ratio; fill a sized parent (e.g. desktop browse tile `h-40`)
 */
export function ProductListingMedia({
  listing,
  src,
  alt,
  variant = "grid",
  feed = false,
  fillFrame = false,
  softChrome = false,
  ring = false,
  className = "",
  imageClassName = "",
  sizes,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  subtleEmptyIcon = false,
  /** Override listing focal rect (e.g. multi-photo card index). */
  focalRect = null,
  /** Gallery index when resolving focal from `listing`. */
  galleryIndex = 0,
  /** Lightbox / full view: show entire image (`object-contain`), ignore focal. */
  showFullImage = false,
}) {
  const resolved = String(src ?? "").trim() || resolveListingCoverImageUrl(listing);
  const label = alt ?? listing?.title ?? "Product";
  const resolvedFocal =
    focalRect != null
      ? focalRect
      : listing && !showFullImage
        ? focalRectForGalleryIndex(listing, galleryIndex)
        : null;

  return (
    <div
      className={cn(
        "lm-product-media",
        !fillFrame && variant === "grid" && !feed && "lm-product-media-grid",
        !fillFrame && variant === "list" && "lm-product-media-list",
        feed && "lm-product-card-media",
        ring && "lm-product-card-media--ring",
        softChrome && "lm-product-media--soft",
        className,
      )}
    >
      <StableMediaImage
        src={resolved}
        alt={label}
        className="absolute inset-0"
        imageClassName={cn("lm-product-image", imageClassName)}
        placeholderClassName="lm-product-image-placeholder"
        sizes={sizes}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        subtleEmptyIcon={subtleEmptyIcon}
        objectFit={showFullImage ? "contain" : "cover"}
        focalRect={showFullImage ? null : resolvedFocal}
      />
    </div>
  );
}
