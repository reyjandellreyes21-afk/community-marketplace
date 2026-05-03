import communityPicture from "../../assets/community-image.png?w=480;720;960;1280&format=avif;webp;png&quality=80&as=picture";
import { LandingArtworkCard } from "./LandingArtworkCard.jsx";

/** Hero image block — split out so the landing bundle can lazy-load it after first paint (mobile TTI). */
export function LandingIllustration() {
  return (
    <LandingArtworkCard
      picture={communityPicture}
      alt="Local community marketplace"
      sizes="(max-width: 1023px) 100vw, min(50vw, 42rem)"
    />
  );
}
