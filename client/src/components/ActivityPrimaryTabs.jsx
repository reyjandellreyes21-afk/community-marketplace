import { getActivityTabChrome } from "../lib/activityTabTheme.js";
import { ACTIVITY_TABS } from "../views.js";
import { ActivityPrimaryTabGlyph } from "./ActivityPrimaryTabGlyph.jsx";

const TAB_BADGE_SLATE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-slate-500 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-slate-600";

const TAB_BADGE_ROSE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-rose-600 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-rose-500";

/**
 * Buying / Selling / Courier strip — rose = unseen (or courier Deliver+purchases slice); slate = pipeline-only fallback.
 *
 * @param {{ count: number, rose?: boolean }} [props.buyingBadge]
 * @param {{ count: number, rose?: boolean }} [props.sellingBadge]
 * @param {{ count: number, rose?: boolean }} [props.courierBadge]
 */
export function ActivityPrimaryTabs({
  activityTab,
  goActivity,
  buyingBadge = { count: 0, rose: false },
  sellingBadge = { count: 0, rose: false },
  courierBadge = { count: 0, rose: false },
}) {
  const tabs = [
    {
      id: ACTIVITY_TABS.BUYING,
      label: "Buying",
      hint: "Purchases you’ve placed with sellers.",
      badge: buyingBadge,
    },
    {
      id: ACTIVITY_TABS.SELLING,
      label: "Selling",
      hint: "Orders from buyers on your listings.",
      badge: sellingBadge,
    },
    {
      id: ACTIVITY_TABS.COURIER,
      label: "Courier",
      badge: courierBadge,
      hint: "Neighbor deliveries, assignments, and suggestions.",
    },
  ];

  return (
    <div
      className="app-shell-content-inset grid w-full min-w-0 grid-cols-3 gap-0 py-1.5 md:py-2"
      role="tablist"
      aria-label="Activity sections"
      onKeyDown={(e) => {
        const ids = [ACTIVITY_TABS.BUYING, ACTIVITY_TABS.SELLING, ACTIVITY_TABS.COURIER];
        const { key } = e;
        if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
        e.preventDefault();
        const idxRaw = ids.indexOf(activityTab);
        const idx = idxRaw >= 0 ? idxRaw : 0;
        let next = idx;
        if (key === "ArrowRight") next = Math.min(ids.length - 1, idx + 1);
        else if (key === "ArrowLeft") next = Math.max(0, idx - 1);
        else if (key === "Home") next = 0;
        else if (key === "End") next = ids.length - 1;
        if (next !== idx) {
          const nextId = ids[next];
          goActivity(nextId);
          queueMicrotask(() => {
            document.getElementById(`activity-primary-tab-${nextId}`)?.focus();
          });
        }
      }}
    >
      {tabs.map(({ id, label, hint, badge }) => {
        const selected = activityTab === id;
        const chrome = getActivityTabChrome(id);
        const b = badge && typeof badge === "object" ? badge : { count: 0, rose: false };
        const rawCount = typeof b.count === "number" ? b.count : 0;
        const count = Math.min(99, Math.max(0, rawCount));
        const rose = Boolean(b.rose);
        const showBadge = count > 0;
        const countDisplay = count > 99 ? "99+" : count;
        return (
          <button
            key={id}
            id={`activity-primary-tab-${id}`}
            type="button"
            role="tab"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-controls="activity-hub-panel"
            title={hint}
            aria-label={
              showBadge ? `${label}, ${String(countDisplay).replace("+", " plus ")}` : label
            }
            className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center px-0.5 py-1 text-center transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 min-[380px]:px-1 ${
              selected ? "" : "hover:bg-neutral-50/90 dark:hover:bg-slate-900/70"
            }`}
            onClick={() => goActivity(id)}
          >
            <span className="flex w-full min-w-0 flex-col items-center gap-1">
              <span className="relative inline-flex shrink-0">
                <ActivityPrimaryTabGlyph
                  tabId={id}
                  selected={selected}
                  selectedAccentClass={chrome.glyphSelected}
                />
                {showBadge ? (
                  <span className={rose ? TAB_BADGE_ROSE : TAB_BADGE_SLATE} aria-hidden>
                    {countDisplay}
                  </span>
                ) : null}
              </span>
              <span
                className={`line-clamp-2 min-w-0 max-w-full px-0.5 text-center text-[10px] font-medium leading-tight tracking-tight md:text-[11px] ${
                  selected ? chrome.labelSelected : "text-neutral-500 dark:text-slate-500"
                }`}
              >
                {label}
              </span>
              <span
                className={`mt-0.5 h-[3px] w-9 shrink-0 rounded-full transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                  selected ? `${chrome.barSelected} opacity-100` : "opacity-0"
                }`}
                aria-hidden
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
