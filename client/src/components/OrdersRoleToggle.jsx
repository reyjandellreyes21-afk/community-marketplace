import { ACTIVITY_TABS } from "../views.js";

const PILL_ROSE_UNSELECTED =
  "bg-rose-600 text-white shadow-sm dark:bg-rose-500";
const PILL_ROSE_SELECTED = "bg-white/95 text-rose-700 dark:bg-white/95 dark:text-rose-800";
const PILL_SEEN_UNSELECTED =
  "bg-slate-500 text-white dark:bg-slate-600";
const PILL_SEEN_SELECTED = "bg-white/95 text-slate-700 dark:bg-white/95 dark:text-slate-800";

const SIDEBAR_BADGE_ROSE =
  "pointer-events-none ml-auto inline-flex min-h-[1rem] min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-rose-500";
const SIDEBAR_BADGE_SLATE =
  "pointer-events-none ml-auto inline-flex min-h-[1rem] min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-500 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-slate-600";

/**
 * Segmented switcher used by both the **Orders** and **Bookings** primary tabs.
 *
 * Two call patterns are supported:
 *
 *  - **Orders** — pass `activityTab` (BUYING/SELLING) + `onChange(nextActivityTab, nextRole)`.
 *    The toggle flips the underlying `activityTab` so the Orders hub switches between
 *    `My Orders` and `My Sales`.
 *  - **Bookings** — pass `role` ("buyer"|"seller") + `onRoleChange(nextRole)`. The
 *    toggle flips the same role as Orders (`My Orders` / `My Sales`) without
 *    changing the activity tab; override `buyerLabel` / `sellerLabel` only if needed.
 *
 * Badge pills: **rose** when `badge.rose` (unseen attention); **slate** when count is seen-queue depth only.
 *
 * @param {Object} props
 * @param {string} [props.activityTab] Current `ACTIVITY_TABS.BUYING` or `ACTIVITY_TABS.SELLING`
 * @param {(nextActivityTab: string, nextRole: "buyer" | "seller") => void} [props.onChange]
 * @param {"buyer"|"seller"} [props.role] Generic role mode for non-orders use (Bookings)
 * @param {(nextRole: "buyer"|"seller") => void} [props.onRoleChange]
 * @param {string} [props.buyerLabel]
 * @param {string} [props.sellerLabel]
 * @param {{ count: number, rose?: boolean }} [props.buyingBadge] Optional unseen-count pill for the buyer segment
 * @param {{ count: number, rose?: boolean }} [props.sellingBadge] Optional unseen-count pill for the seller segment
 * @param {string} [props.ariaLabel] Override for the tablist `aria-label`
 * @param {string} [props.className] Wrapper extra classes
 * @param {boolean} [props.desktopSidebar] Vertical rail for md+ Activity hub left aside
 */
export function OrdersRoleToggle({
  activityTab,
  onChange,
  role,
  onRoleChange,
  buyerLabel = "My Orders",
  sellerLabel = "My Sales",
  buyingBadge = { count: 0, rose: false },
  sellingBadge = { count: 0, rose: false },
  ariaLabel = "Orders view",
  className = "",
  desktopSidebar = false,
}) {
  const usingRoleMode = role === "buyer" || role === "seller";
  const isBuyer = usingRoleMode ? role === "buyer" : activityTab !== ACTIVITY_TABS.SELLING;
  const segments = [
    {
      id: "buyer",
      label: buyerLabel,
      activityTab: ACTIVITY_TABS.BUYING,
      badge: buyingBadge,
      selected: isBuyer,
      selectedBorder: "border-indigo-500 dark:border-indigo-400",
    },
    {
      id: "seller",
      label: sellerLabel,
      activityTab: ACTIVITY_TABS.SELLING,
      badge: sellingBadge,
      selected: !isBuyer,
      selectedBorder: "border-emerald-500 dark:border-emerald-400",
    },
  ];

  const tabListClass = desktopSidebar
    ? `flex w-full min-w-0 flex-col gap-1 ${className}`
    : `flex w-full min-w-0 items-stretch gap-1.5 ${className}`;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={desktopSidebar ? "vertical" : undefined}
      className={tabListClass}
    >
      {segments.map((seg) => {
        const rawCount = Number(seg.badge?.count) || 0;
        const count = Math.min(99, Math.max(0, rawCount));
        const rose = Boolean(seg.badge?.rose);
        const showBadge = count > 0;
        const countDisplay = count > 99 ? "99+" : count;
        const pillClass = rose
          ? seg.selected
            ? PILL_ROSE_SELECTED
            : PILL_ROSE_UNSELECTED
          : seg.selected
            ? PILL_SEEN_SELECTED
            : PILL_SEEN_UNSELECTED;

        if (desktopSidebar) {
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={seg.selected}
              tabIndex={seg.selected ? 0 : -1}
              aria-label={showBadge ? `${seg.label}, ${String(countDisplay).replace("+", " plus ")}` : seg.label}
              onClick={() => {
                if (seg.selected) return;
                if (usingRoleMode) {
                  onRoleChange?.(seg.id);
                } else {
                  onChange?.(seg.activityTab, seg.id);
                }
              }}
              className={`relative flex w-full min-w-0 flex-row items-center gap-2 rounded-r-lg border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 ${
                seg.selected
                  ? `${seg.selectedBorder} bg-neutral-100/90 dark:bg-slate-800/65`
                  : "border-transparent hover:bg-neutral-50/95 dark:hover:bg-slate-800/45"
              }`}
            >
              <span
                className={`min-w-0 flex-1 text-xs font-semibold leading-tight ${
                  seg.selected ? "text-indigo-700 dark:text-indigo-300" : "text-neutral-600 dark:text-slate-400"
                }`}
              >
                {seg.label}
              </span>
              {showBadge ? (
                <span className={rose ? SIDEBAR_BADGE_ROSE : SIDEBAR_BADGE_SLATE} aria-hidden>
                  {countDisplay}
                </span>
              ) : null}
            </button>
          );
        }

        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={seg.selected}
            tabIndex={seg.selected ? 0 : -1}
            onClick={() => {
              if (seg.selected) return;
              if (usingRoleMode) {
                onRoleChange?.(seg.id);
              } else {
                onChange?.(seg.activityTab, seg.id);
              }
            }}
            className={`relative flex min-h-[3rem] flex-1 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-sm font-semibold leading-tight transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 min-[380px]:gap-2 min-[380px]:px-3 md:px-4 ${
              seg.selected
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:bg-indigo-500 dark:shadow-indigo-500/25"
                : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="min-w-0 truncate">{seg.label}</span>
            {showBadge ? (
              <span aria-hidden className={`inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-[5px] py-px text-[10px] font-bold tabular-nums leading-none ${pillClass}`}>
                {countDisplay}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
