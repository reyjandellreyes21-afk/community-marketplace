/**
 * Logged-out landing hero image only. The “easiest way to trade” block uses a separate
 * vector illustration (`LandingFeaturesIllustration`) so the two sections are not identical.
 * Replace `assets/community-image.png` to refresh the hero.
 */
import landingHeroPicture from "../assets/landing-page.png?w=360;480;640;768;960;1280&format=avif;webp;png&quality=80&as=picture";

/** @deprecated Use `landingHeroPicture`. */
const landingPrimaryPicture = landingHeroPicture;

export { landingHeroPicture, landingPrimaryPicture };
