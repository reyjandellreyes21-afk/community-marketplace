/**
 * Renders vite-imagetools `as=picture` payload: `{ sources: { avif?, webp?, ... }, img: { src, w, h } }`.
 * AVIF/WebP sources are ordered before PNG/JPEG fallback on `<img>`.
 */
export function ImagetoolsPicture({
  picture,
  alt = "",
  className = "",
  sizes,
  loading,
  decoding = "async",
  fetchPriority,
  /** When the layout needs `<picture className="…">` (e.g. fill a ratio box). */
  pictureClassName,
}) {
  const data = picture?.default ?? picture;
  const sources = data?.sources ?? {};
  const img = data?.img;
  if (!img?.src) return null;

  const typeFor = (fmt) => {
    const f = String(fmt || "").toLowerCase();
    if (f === "jpg" || f === "jpeg") return "image/jpeg";
    return `image/${f}`;
  };

  const order = ["avif", "webp", "png", "jpeg", "jpg"];
  const keys = Object.keys(sources).sort((a, b) => {
    const ia = order.indexOf(a.toLowerCase());
    const ib = order.indexOf(b.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <picture className={pictureClassName}>
      {keys.map((fmt) => {
        const srcset = sources[fmt];
        if (!srcset) return null;
        return <source key={fmt} type={typeFor(fmt)} srcSet={srcset} sizes={sizes} />;
      })}
      <img
        src={img.src}
        width={img.w}
        height={img.h}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}
