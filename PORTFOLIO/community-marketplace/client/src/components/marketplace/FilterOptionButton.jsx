export function FilterOptionButton({ active, onClick, icon, label, compact = false, sheet = false }) {
  const size =
    sheet === true
      ? "min-h-[44px] rounded-xl px-3 py-2 text-left text-sm font-medium leading-snug"
      : compact === true
        ? "min-h-[2.35rem] rounded-lg px-2 py-1.5 text-left text-xs font-medium leading-snug"
        : "min-h-[2.75rem] rounded-xl px-3 py-2.5 text-left text-sm font-medium leading-tight";
  const inactiveSurface =
    sheet === true
      ? "border-neutral-200/90 bg-neutral-100/90 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      : "border-transparent bg-white/80 text-neutral-700 hover:border-neutral-200 hover:bg-white dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800";
  const gap = sheet ? "gap-2.5" : compact ? "gap-1" : "gap-1.5";
  return (
    <button
      type="button"
      className={`${size} w-full border transition ${
        active
          ? "border-brand-primary/50 bg-white text-brand-primary shadow-sm ring-2 ring-brand-primary/20 dark:border-brand-accent/40 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-accent/25"
          : inactiveSurface
      }`}
      onClick={onClick}
    >
      <span className={`inline-flex w-full min-w-0 items-center ${gap}`}>
        <span className="shrink-0 [&_svg]:text-current">{icon}</span>
        <span className="min-w-0 flex-1 text-left break-words">{label}</span>
      </span>
    </button>
  );
}
