import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn.js";

function ImageGlyphIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.75" />
      <path d="M21 15l-5-5-4 4-2-2-5 5" />
    </svg>
  );
}

/**
 * Product / listing photo with fixed-frame loading skeleton and error fallback — avoids layout shift and broken-image icons.
 * Parent must set dimensions (`h-40`, `aspect-*`, `max-w-*`, etc.); this component fills `className` with `relative h-full w-full` by default.
 *
 * - Default `object-cover` for photos; set `objectFit="contain"` for logos or lightbox-style frames.
 * - Default `loading="lazy"`; set `eager` for above-the-fold hero images.
 */
export function StableMediaImage({
  src,
  alt = "",
  className = "",
  imageClassName = "",
  sizes,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  /** Very subtle icon on empty / error (optional) */
  subtleEmptyIcon = false,
  objectFit = "cover",
  /** Applied to the empty / error placeholder layer (e.g. `lm-product-image-placeholder`) */
  placeholderClassName = "",
}) {
  const trimmed = String(src || "").trim();
  const hasSrc = Boolean(trimmed);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [trimmed]);

  useEffect(() => {
    if (!hasSrc) return;
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, [hasSrc, trimmed]);

  const showLiveImg = hasSrc && !error;
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      className={cn(
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-neutral-100 dark:bg-[#11283d]/60",
        className,
      )}
    >
      {showLiveImg ? (
        <>
          {!loaded ? (
            <div
              className="absolute inset-0 z-[1] animate-pulse bg-neutral-200/55 motion-reduce:animate-none dark:bg-slate-700/50"
              aria-hidden
            />
          ) : null}
          <img
            ref={imgRef}
            src={trimmed}
            alt={alt}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setError(true);
              setLoaded(false);
            }}
            className={cn(
              "absolute inset-0 z-[2] h-full w-full transition-opacity duration-200 motion-reduce:transition-none",
              fitClass,
              loaded ? "opacity-100" : "opacity-0",
              imageClassName,
            )}
            loading={loading}
            decoding={decoding}
            sizes={sizes}
            fetchPriority={fetchPriority}
          />
        </>
      ) : null}
      {(!hasSrc || error) && (
        <div
          className={cn(
            "absolute inset-0 z-[3] flex flex-col items-center justify-center gap-1 bg-neutral-100/98 px-2 dark:bg-[#11283d]/98",
            placeholderClassName,
          )}
        >
          {subtleEmptyIcon ? (
            <ImageGlyphIcon className="h-8 w-8 text-neutral-400/30 dark:text-slate-500/40" aria-hidden />
          ) : (
            <ImageGlyphIcon className="h-8 w-8 text-neutral-400/55 dark:text-slate-500/55" aria-hidden />
          )}
          <span className="sr-only">{error ? "Image failed to load." : "No image."}</span>
          {error ? (
            <span
              className="max-w-[11rem] text-center text-[10px] font-medium leading-snug text-neutral-500 dark:text-slate-400 md:hidden"
              aria-hidden
            >
              Couldn&apos;t load image
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Circular avatar with skeleton while loading and safe fallback (initials) on missing/broken URL.
 * Wrapper size should match your layout (`h-8 w-8`, `h-10 w-10`, …).
 */
export function StableAvatar({
  src,
  alt = "",
  initials,
  className = "",
  textClassName = "",
  sizes = "64px",
  /** Square tiles (e.g. profile card) instead of circle */
  square = false,
}) {
  const trimmed = String(src || "").trim();
  const hasSrc = Boolean(trimmed);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [trimmed]);

  useEffect(() => {
    if (!hasSrc) return;
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, [hasSrc, trimmed]);

  const showImg = hasSrc && !error;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-soft text-xs font-bold text-brand-primary",
        square ? "rounded-2xl" : "rounded-full",
        className,
      )}
    >
      {showImg ? (
        <>
          {!loaded ? (
            <span
              className="absolute inset-0 animate-pulse bg-brand-muted/80 motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          <img
            ref={imgRef}
            src={trimmed}
            alt={alt}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setError(true);
              setLoaded(false);
            }}
            className={cn(
              "relative z-[1] h-full w-full object-cover transition-opacity duration-150 motion-reduce:transition-none",
              loaded ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            sizes={sizes}
          />
        </>
      ) : null}
      {(!hasSrc || error) && (
        <span className={cn("relative z-[2] px-0.5 text-center leading-none", textClassName)}>{initials}</span>
      )}
    </span>
  );
}
