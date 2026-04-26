import { UI_KIT } from "../../lib/appUiKit.js";

export function SectionHeading({ title, subtitle, trailing = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={UI_KIT.sectionTitle}>{title}</h2>
        {subtitle ? <p className={UI_KIT.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}
