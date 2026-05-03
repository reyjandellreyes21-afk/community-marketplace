import { ImagetoolsPicture } from "../media/ImagetoolsPicture.jsx";

/**
 * Shared frame for landing illustrations — matches hero card (rounded shell, violet gradient, soft shadow).
 */
export function LandingArtworkCard({
  picture,
  alt,
  sizes,
  className = "",
  pictureClassName = "",
  objectPosition = "object-[74%_center]",
  aspectClassName = "aspect-[16/10]",
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[1.75rem] border border-neutral-200/80 bg-gradient-to-br from-white to-violet-50/60 shadow-[0_18px_45px_-28px_rgba(67,56,202,0.45)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80 ${className}`}
    >
      <div className={`${aspectClassName} w-full`}>
        <ImagetoolsPicture
          picture={picture}
          alt={alt}
          className={`h-full w-full object-cover ${objectPosition}`}
          pictureClassName={`block h-full w-full ${pictureClassName}`}
          sizes={sizes}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
