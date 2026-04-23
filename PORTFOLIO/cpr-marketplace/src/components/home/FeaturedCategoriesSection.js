import Image from "next/image";

export default function FeaturedCategoriesSection({
  featuredCategories,
  showAllCategories,
  setShowAllCategories,
  carouselItems,
  visibleCount,
  trackIndex,
  isTransitionEnabled,
  handleTrackTransitionEnd,
  handlePrevClick,
  handleNextClick,
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Featured Categories</h2>
        <div className="flex items-center gap-2">
          {!showAllCategories && (
            <>
              <button
                type="button"
                onClick={handlePrevClick}
                aria-label="Previous categories"
                className="px-0.5 text-xl font-bold leading-none text-slate-700 transition hover:text-teal-600"
              >
                &larr;
              </button>
              <button
                type="button"
                onClick={handleNextClick}
                aria-label="Next categories"
                className="px-0.5 text-xl font-bold leading-none text-slate-700 transition hover:text-teal-600"
              >
                &rarr;
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowAllCategories((prev) => !prev)}
            className="text-sm font-normal text-teal-700 transition hover:text-teal-600"
          >
            {showAllCategories ? "Hide all" : "View all"}
          </button>
        </div>
      </div>
      {!showAllCategories && (
        <div className="mt-5 overflow-hidden">
          <div
            onTransitionEnd={handleTrackTransitionEnd}
            className={`flex transform-gpu ${isTransitionEnabled ? "transition-transform duration-1000 ease-in-out" : ""}`}
            style={{ transform: `translateX(-${trackIndex * (100 / visibleCount)}%)` }}
          >
            {carouselItems.map((category, index) => (
              <article
                key={`${category.name}-${index}`}
                className="shrink-0 px-2"
                style={{ width: `${100 / visibleCount}%` }}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                  <div className="flex items-center justify-center">
                    <Image src={category.icon} alt={category.name} width={44} height={44} unoptimized />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-800">{category.name}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      <div
        className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showAllCategories ? "mt-6 max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="grid gap-4 pb-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {featuredCategories.map((category) => (
            <article
              key={`all-${category.name}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-center"
            >
              <div className="flex items-center justify-center">
                <Image src={category.icon} alt={category.name} width={44} height={44} unoptimized />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{category.name}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
