export function SectionHeading({ title, subtitle, trailing = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="ui-section-title">{title}</h2>
        {subtitle ? <p className="ui-section-subtitle">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}
