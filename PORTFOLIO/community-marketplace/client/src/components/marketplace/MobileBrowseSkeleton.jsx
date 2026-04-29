import { cn } from "../../lib/cn.js";
import { UI_KIT } from "../../lib/appUiKit.js";
import { sellerListingsGridClass } from "../../lib/lmViewLayouts.js";

const listRowClass = "lm-card flex gap-3 p-3.5";

const pulse =
  "animate-pulse motion-reduce:animate-none bg-neutral-200/70 dark:bg-slate-700/55";

function SkeletonBlock({ className }) {
  return <div className={cn(pulse, className)} aria-hidden />;
}

/** Mirrors `CommunityShopListingCard` list layout: thumb + detail + two actions. */
function CommunityListRowSkeleton() {
  return (
    <div className={cn("group relative", listRowClass)}>
      <div className="lm-product-media lm-product-media-list relative h-32 w-32 shrink-0">
        <SkeletonBlock className="absolute inset-0 rounded-[var(--ui-radius-lg)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <SkeletonBlock className="h-4 w-[88%] rounded-md" />
        <SkeletonBlock className="h-5 w-[42%] rounded-md" />
        <SkeletonBlock className="h-[4.25rem] w-full rounded-xl" />
        <div className="grid w-full grid-cols-3 gap-2 pt-1">
          <SkeletonBlock className="h-10 w-full rounded-xl" />
          <SkeletonBlock className="h-10 w-full rounded-xl" />
          <SkeletonBlock className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Grid tile — matches comfortable / soft-browse / compact community cards (fixed image frame + text + CTA stack).
 */
function CommunityGridTileSkeleton({ compact, softBrowseChrome }) {
  /** Align with `CommunityShopListingCard` mobile feed (`useFeedLayout`): square hero + flush chrome */
  const feedChrome = Boolean(softBrowseChrome && !compact);
  const pad = feedChrome ? "p-0" : compact ? "p-2.5" : "p-3.5";
  const imgBox = feedChrome
    ? "lm-product-card-media aspect-square w-full min-h-0"
    : compact
      ? "lm-product-card-media h-28 max-h-28 w-full !aspect-auto overflow-hidden"
      : softBrowseChrome
        ? "aspect-[4/3] w-full min-h-[7.5rem] max-h-[10.5rem] min-[640px]:max-h-[11rem]"
        : "h-40 w-full min-[640px]:h-44 md:h-48";
  const imageFrame = feedChrome
    ? "lm-product-card-media lm-product-card-media--ring"
    : softBrowseChrome && !feedChrome
      ? "lm-card-media-soft"
      : compact
        ? "lm-product-card-media"
        : "lm-card-media";
  const mainGap = compact ? "gap-1" : "gap-2";

  return (
    <div
      className={cn(
        feedChrome ? "lm-product-card lm-product-card--feed" : "",
        "lm-card lm-grid-card flex h-full min-h-0 flex-col overflow-hidden",
        pad,
      )}
    >
      <div className={cn("flex min-h-0 flex-1 flex-col", feedChrome ? "gap-0" : mainGap)}>
        <div className={cn(imageFrame, imgBox)}>
          <SkeletonBlock className={cn("absolute inset-0", feedChrome ? "rounded-t-[var(--ui-radius-lg)] rounded-b-none md:rounded-t-2xl" : "rounded-xl")} />
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-col",
            feedChrome ? "lm-product-card-body gap-2" : compact ? "gap-1" : "gap-2",
          )}
        >
          <SkeletonBlock className={cn("rounded-md", compact ? "h-3.5 w-[92%]" : feedChrome ? "h-3.5 w-[94%]" : "h-4 w-[90%]")} />
          <SkeletonBlock className={cn("rounded-md", compact ? "h-4 w-[55%]" : feedChrome ? "h-4 w-[52%]" : "h-5 w-[48%]")} />
          {!compact && !feedChrome ? <SkeletonBlock className="h-[4rem] w-full rounded-xl" /> : null}
          {!compact && feedChrome ? <SkeletonBlock className="h-3 w-full rounded-md opacity-70" /> : null}
          {compact ? <SkeletonBlock className="h-8 w-full rounded-lg" /> : null}
        </div>
      </div>
      <div
        className={cn(
          "mt-auto flex flex-col gap-2",
          feedChrome ? "px-2 pb-2 pt-1.5 min-[400px]:px-2.5 min-[400px]:pb-2.5" : "pt-3",
        )}
      >
        {!compact && !feedChrome ? <SkeletonBlock className="h-11 w-full rounded-xl" /> : null}
        <div className={compact ? "grid w-full grid-cols-2 gap-2" : feedChrome ? "grid w-full grid-cols-2 gap-2" : "flex w-full flex-col gap-2"}>
          <SkeletonBlock className={cn("rounded-xl", compact || feedChrome ? "h-10 w-full" : "min-h-[44px] w-full")} />
          <SkeletonBlock className={cn("rounded-xl", compact || feedChrome ? "h-10 w-full" : "min-h-[44px] w-full")} />
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile-first: skeleton grid matches final browse density (list vs grid vs compact) to avoid CLS when data arrives.
 *
 * @param {object} props
 * @param {string} props.gridClassName — same as `communityBrowseGridClass` / `favoritesGridClass` output
 * @param {'list' | 'grid' | 'compact'} props.variant
 * @param {boolean} [props.softBrowseChrome] — community shop grid on phone (aspect hero + ring)
 * @param {number} [props.count]
 * @param {string} [props.className]
 * @param {string} [props.ariaLabel]
 */
export function BrowseGridSkeleton({
  gridClassName,
  variant,
  softBrowseChrome = false,
  count = 6,
  className = "",
  ariaLabel = "Loading listings",
}) {
  const n = Math.max(1, Math.min(12, count));
  const items = Array.from({ length: n }, (_, i) => i);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn("w-full", className)}
    >
      <span className="sr-only">{ariaLabel}</span>
      <div className={gridClassName}>
        {items.map((k) =>
          variant === "list" ? (
            <CommunityListRowSkeleton key={k} />
          ) : (
            <div key={k} className={variant === "grid" || variant === "compact" ? "min-h-0" : ""}>
              <CommunityGridTileSkeleton compact={variant === "compact"} softBrowseChrome={softBrowseChrome && variant !== "list"} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** Public share link: same vertical rhythm as loaded `Card` (hero image + title + price + primary button). */
export function PublicListingDetailSkeleton({ className = "" }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading listing"
      className={cn("space-y-4", className)}
    >
      <span className="sr-only">Loading listing</span>
      <div className={cn(UI_KIT.surfaceRaised, "space-y-4 rounded-xl border border-dashed p-4 md:border-solid")}>
        <SkeletonBlock className="h-7 w-[88%] rounded-md" />
        <SkeletonBlock className="h-9 w-[36%] rounded-md" />
        <div className="relative h-64 w-full overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-100 dark:border-slate-700 dark:bg-slate-900/50">
          <SkeletonBlock className="absolute inset-0 rounded-xl" />
        </div>
        <SkeletonBlock className="h-4 w-[40%] rounded-md" />
        <div className="space-y-2">
          <SkeletonBlock className="h-3.5 w-full rounded-md" />
          <SkeletonBlock className="h-3.5 w-full rounded-md" />
          <SkeletonBlock className="h-3.5 w-[72%] rounded-md" />
        </div>
        <SkeletonBlock className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

function SellerListRowSkeleton() {
  return (
    <div className={cn(UI_KIT.surfaceCard, "space-y-3 p-3.5")}>
      <div className="flex gap-3">
        <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-[#11283d]/60 md:h-40 md:w-40">
          <SkeletonBlock className="absolute inset-0 rounded-xl" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-[80%] rounded-md" />
          <SkeletonBlock className="h-6 w-[40%] rounded-md" />
          <SkeletonBlock className="h-14 w-full rounded-xl" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SkeletonBlock className="h-9 min-w-[5rem] flex-1 rounded-lg" />
        <SkeletonBlock className="h-9 min-w-[5rem] flex-1 rounded-lg" />
        <SkeletonBlock className="h-9 w-10 shrink-0 rounded-lg" />
      </div>
    </div>
  );
}

function SellerGridTileSkeleton({ compact }) {
  return (
    <div className={cn(UI_KIT.surfaceCard, "flex h-full flex-col p-3", compact ? "p-2.5" : "p-3.5")}>
      <div className={cn("relative w-full overflow-hidden rounded-xl", compact ? "h-28" : "aspect-[4/3] min-h-[9rem]")}>
        <SkeletonBlock className="absolute inset-0 rounded-xl" />
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        <SkeletonBlock className={cn("rounded-md", compact ? "h-3 w-[92%]" : "h-4 w-[88%]")} />
        <SkeletonBlock className="h-5 w-[45%] rounded-md" />
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <SkeletonBlock className="h-9 flex-1 rounded-lg" />
          <SkeletonBlock className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Profile / My listings snapshot — matches `sellerListingsGridClass` from `lib/lmViewLayouts.js`.
 */
export function SellerListingsSkeletonGrid({ view, className = "" }) {
  const listMode = view === "list";
  const compact = view === "compact";
  const gridClass = sellerListingsGridClass(view);

  const count = listMode ? 3 : compact ? 8 : 4;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading your listings"
      className={cn("w-full", className)}
    >
      <span className="sr-only">Loading your listings</span>
      <ul className={gridClass}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="min-w-0">
            {listMode ? <SellerListRowSkeleton /> : <SellerGridTileSkeleton compact={compact} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
