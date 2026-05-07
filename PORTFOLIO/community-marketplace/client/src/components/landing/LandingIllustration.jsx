import { landingHeroPicture } from "../../lib/landingPrimaryArtwork.js";
import { LandingArtworkCard } from "./LandingArtworkCard.jsx";

/** Hero image block — split out so the landing bundle can lazy-load it after first paint (mobile TTI). */
export function LandingIllustration() {
  return (
    <LandingArtworkCard
      picture={landingHeroPicture}
      alt="Local community marketplace"
      sizes="(max-width: 1023px) 100vw, min(50vw, 42rem)"
    />
  );
}
