import brandPicture from "../../assets/new-brand-logo.png?w=160;240;320&format=avif;webp;png&quality=85&as=picture";
import { ImagetoolsPicture } from "./ImagetoolsPicture.jsx";

export function LinkMartLogo({
  className = "h-8 w-auto max-w-[12rem] shrink-0 object-contain md:h-9 md:max-w-[13.5rem]",
}) {
  return (
    <ImagetoolsPicture
      picture={brandPicture}
      alt="LinkMart logo"
      className={className}
      sizes="(max-width: 768px) min(46vw, 12rem), 14rem"
      loading="eager"
      decoding="async"
    />
  );
}
