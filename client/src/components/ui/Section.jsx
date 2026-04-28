import { cn } from "../../lib/cn.js";

/**
 * Vertical rhythm + optional eyebrow / title / subtitle using shared typography utilities.
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
  ...props
}) {
  const TitleTag = titleAs;
  const hasHeader = Boolean(eyebrow || title || subtitle);
  return (
    <Comp className={cn("ui-section", className)} {...props}>
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
