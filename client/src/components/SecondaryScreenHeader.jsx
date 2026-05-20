/**
 * Sticky top bar for secondary screens (About, Terms, Send feedback): back control + title (same on mobile and web).
 */
export function SecondaryScreenHeader({ title, onBack, backButtonAriaLabel = "Back" }) {
  return (
    <div className="sticky top-0 z-[1] -mx-3.5 mb-1 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 bg-white/95 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 max-[360px]:-mx-3 max-[360px]:px-2.5 max-[390px]:-mx-3 max-[430px]:-mx-3.5 md:static md:z-auto md:mx-0 md:mb-4 md:flex-nowrap md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none dark:border-[#1f3c56]/75 dark:bg-[#0f2234]/98 dark:supports-[backdrop-filter]:bg-[#0f2234]/92 md:dark:bg-transparent md:dark:border-transparent">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-neutral-700 transition hover:bg-neutral-100 active:bg-neutral-100 dark:text-slate-100 dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]"
          aria-label={backButtonAriaLabel}
          onClick={() => onBack?.()}
        >
          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 6l-6 6 6 6" />
          </svg>
        </button>
        <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-neutral-900 dark:text-slate-100 max-[360px]:text-base md:flex-none md:text-xl">
          {title}
        </h2>
      </div>
    </div>
  );
}
