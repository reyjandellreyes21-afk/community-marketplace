export function OsmAttribution({ className = "" }) {
  return (
    <p
      className={`text-[10px] leading-snug text-text-secondary dark:text-slate-400 ${className}`.trim()}
    >
      Map ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-primary dark:hover:text-brand-accent"
      >
        OpenStreetMap
      </a>{" "}
      &{" "}
      <a
        href="https://carto.com/attributions"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-primary dark:hover:text-brand-accent"
      >
        CARTO
      </a>
    </p>
  );
}
