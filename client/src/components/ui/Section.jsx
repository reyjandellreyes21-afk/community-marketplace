import { cn } from "../../lib/cn.js";
import { MOBILE_UI } from "../../lib/mobileUi.js";

const DENSITY_CLASS = {
  default: "ui-section",
  compact: "space-y-3 md:space-y-4",
  relaxed: "space-y-5 md:space-y-6",
};

/**
 * Vertical rhythm + optional eyebrow / title / subtitle (mobile type scale in `index.css`).
 * `inset` — horizontal padding aligned with the mobile shell when the section sits in a full-bleed parent.
 * `density` — `compact` tightens vertical gaps on small screens; `relaxed` for marketing-style blocks.
 */
export function Section({
  as: Comp = "section",
  eyebrow,
  title,
  subtitle,
  children,
  className,
  headerClassName,
  titleAs = "h2",
  inset = false,
  density = "default",
  ...props
}) {
  const TitleTag = titleAs;
  const hasHeader = Boolean(eyebrow || title || subtitle);
  const stack = DENSITY_CLASS[density] ?? DENSITY_CLASS.default;
  return (
    <Comp
      className={cn(stack, inset && MOBILE_UI.insetX, className)}
      {...props}
    >
      {hasHeader ? (
        <header className={cn("space-y-1", headerClassName)}>
          {eyebrow ? <p className="ui-section-eyebrow">{eyebrow}</p> : null}
          {title ? <TitleTag className="ui-section-title">{title}</TitleTag> : null}
          {subtitle ? <p className="ui-section-subtitle">{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </Comp>
  );
}
