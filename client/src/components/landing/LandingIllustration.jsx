import communityPicture from "../../assets/community-image.png?w=480;720;960;1280&format=avif;webp;png&quality=80&as=picture";
import { ImagetoolsPicture } from "../media/ImagetoolsPicture.jsx";

/** Hero image block — split out so the landing bundle can lazy-load it after first paint (mobile TTI). */
export function LandingIllustration() {
  return (
    <div className="relative w-full overflow-hidden rounded-[1.75rem] border border-neutral-200/80 bg-gradient-to-br from-white to-violet-50/60 shadow-[0_18px_45px_-28px_rgba(67,56,202,0.45)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/80">
      <div className="aspect-[16/10] w-full">
        <ImagetoolsPicture
          picture={communityPicture}
          alt="Local community marketplace"
          className="h-full w-full object-cover object-[74%_center]"
          pictureClassName="block h-full w-full"
          sizes="(max-width: 1023px) 100vw, min(50vw, 42rem)"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
