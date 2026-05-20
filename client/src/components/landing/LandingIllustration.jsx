import { landingHeroPicture } from "../../lib/landingPrimaryArtwork.js";
import { ImagetoolsPicture } from "../media/ImagetoolsPicture.jsx";

/** Hero image block — split out so the landing bundle can lazy-load it after first paint (mobile TTI). */
export function LandingIllustration() {
  return (
    <ImagetoolsPicture
      picture={landingHeroPicture}
      alt="LinkMart logo"
      className="mx-auto h-auto w-28 md:w-64 lg:w-72"
      pictureClassName="block"
      sizes="(max-width: 768px) 7rem, (max-width: 1024px) 16rem, 18rem"
      loading="lazy"
      decoding="async"
    />
  );
}
