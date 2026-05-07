import { getActivityTabChrome } from "../lib/activityTabTheme.js";
import { ACTIVITY_TABS } from "../views.js";
import { ActivityPrimaryTabGlyph } from "./ActivityPrimaryTabGlyph.jsx";

const TAB_BADGE_SLATE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-slate-500 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-slate-600";

const TAB_BADGE_ROSE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-rose-600 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-rose-500";

/**
 * Buying / Selling / Courier strip — rose = unseen (or open courier tasks + buyer assign slice); slate = pipeline-only fallback.
 *
 * @param {{ count: number, rose?: boolean }} [props.buyingBadge]
 * @param {{ count: number, rose?: boolean }} [props.sellingBadge]
 * @param {{ count: number, rose?: boolean }} [props.courierBadge]
 * @param {boolean} [props.embedInActivityCard] When true, strip outer shell inset (desktop card layout)
 * @param {boolean} [props.desktopSidebar] When true, vertical rail (md+ Activity hub only — parent should not render on mobile)
 * @param {boolean} [props.courierProfileIncomplete] Courier tab tooltip when profile lacks required fields for runs
 */
export function ActivityPrimaryTabs({
  activityTab,
  goActivity,
  buyingBadge = { count: 0, rose: false },
  sellingBadge = { count: 0, rose: false },
  courierBadge = { count: 0, rose: false },
  embedInActivityCard = false,
  desktopSidebar = false,
  courierProfileIncomplete = false,
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

  const tabListClass = desktopSidebar
    ? "flex w-full min-w-0 flex-col gap-1"
    : embedInActivityCard
      ? "flex w-full min-w-0 flex-wrap justify-center gap-0.5 md:flex-nowrap md:gap-2 md:px-0"
      : "grid w-full min-w-0 grid-cols-3 gap-0 max-md:shadow-none md:w-auto md:min-w-[min(22rem,calc(100vw-2rem))] md:max-w-[26rem] md:gap-0.5 md:rounded-2xl md:border md:border-neutral-200/90 md:bg-white/95 md:p-1 md:shadow-[0_8px_30px_-14px_rgba(15,23,42,0.18)] md:dark:border-slate-600 md:dark:bg-slate-900/92 md:dark:shadow-[0_12px_36px_-16px_rgba(0,0,0,0.55)]";

  const outerWrapClass = desktopSidebar
    ? "flex w-full min-w-0 justify-stretch py-0"
    : embedInActivityCard
      ? "flex w-full min-w-0 justify-center py-0"
      : "app-shell-content-inset flex w-full min-w-0 justify-center py-1.5 md:py-2.5";

  const sidebarSelectedBorder = (id) => {
    if (id === ACTIVITY_TABS.BUYING) return "border-emerald-500 dark:border-emerald-400";
    if (id === ACTIVITY_TABS.SELLING) return "border-amber-500 dark:border-amber-400";
    return "border-violet-500 dark:border-violet-400";
  };

  return (
    <div className={outerWrapClass}>
      <div
        className={tabListClass}
        role="tablist"
        aria-label="Activity sections"
        aria-orientation={desktopSidebar ? "vertical" : undefined}
        onKeyDown={(e) => {
          const ids = [ACTIVITY_TABS.BUYING, ACTIVITY_TABS.SELLING, ACTIVITY_TABS.COURIER];
          const { key } = e;
          const vertical = desktopSidebar;
          const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
          const nextKey = vertical ? "ArrowDown" : "ArrowRight";
          if (key !== prevKey && key !== nextKey && key !== "Home" && key !== "End") return;
          e.preventDefault();
          const idxRaw = ids.indexOf(activityTab);
          const idx = idxRaw >= 0 ? idxRaw : 0;
          let next = idx;
          if (key === nextKey) next = Math.min(ids.length - 1, idx + 1);
          else if (key === prevKey) next = Math.max(0, idx - 1);
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
      {tabs.map(({ id, label, hint: hintBase, badge }) => {
        const hint =
          id === ACTIVITY_TABS.COURIER && courierProfileIncomplete
            ? `${hintBase} Finish your profile before turning on courier availability.`
            : hintBase;
        const selected = activityTab === id;
        const chrome = getActivityTabChrome(id);
        const b = badge && typeof badge === "object" ? badge : { count: 0, rose: false };
        const rawCount = typeof b.count === "number" ? b.count : 0;
        const count = Math.min(99, Math.max(0, rawCount));
        const rose = Boolean(b.rose);
        const showBadge = count > 0;
        const countDisplay = count > 99 ? "99+" : count;
        const embedSelected =
          embedInActivityCard && selected
            ? "md:border-0 md:bg-transparent md:shadow-none md:ring-0"
            : "";
        const embedUnselected = embedInActivityCard && !selected ? "md:hover:bg-neutral-50/90 dark:md:hover:bg-slate-900/70" : "";
        const pillSelected =
          !embedInActivityCard && selected
            ? `${chrome.segmentActiveMuted} max-md:!bg-transparent max-md:!shadow-none max-md:!ring-0`
            : "";
        const pillUnselected =
          !embedInActivityCard && !selected
            ? "hover:bg-neutral-50/90 dark:hover:bg-slate-900/70 md:hover:bg-neutral-100/85 dark:md:hover:bg-slate-800/75"
            : "";
        const embedButtonLayout =
          embedInActivityCard
            ? "shrink-0 md:min-h-[2.5rem] md:min-w-[6rem] md:rounded-lg md:px-3 md:py-2 md:transition-colors md:duration-150 md:ease-out"
            : "";

        const sidebarBtn =
          desktopSidebar &&
          `relative flex w-full min-w-0 flex-row items-center gap-2 rounded-r-lg border-l-[3px] py-2.5 pl-2.5 pr-2 text-left transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 ${
            selected
              ? `${sidebarSelectedBorder(id)} bg-neutral-100/90 dark:bg-slate-800/65`
              : "border-transparent hover:bg-neutral-50/95 dark:hover:bg-slate-800/45"
          }`;

        if (desktopSidebar) {
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
              className={sidebarBtn}
              onClick={() => goActivity(id)}
            >
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
                className={`min-w-0 flex-1 text-xs font-semibold leading-tight ${
                  selected ? chrome.labelSelected : "text-neutral-600 dark:text-slate-400"
                }`}
              >
                {label}
              </span>
            </button>
          );
        }

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
            className={`relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center px-0.5 py-1 text-center transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 min-[380px]:px-1 ${embedButtonLayout} ${
              embedInActivityCard
                ? `${embedSelected} ${embedUnselected}`
                : `${pillSelected} ${pillUnselected}`
            }`}
            onClick={() => goActivity(id)}
          >
            <span className="flex w-full min-w-0 flex-col items-center gap-1">
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
                  className={`line-clamp-2 min-w-0 max-w-full shrink-0 px-0.5 text-center text-[10px] font-semibold leading-tight tracking-tight md:text-xs ${
                    selected
                      ? chrome.labelSelected
                      : embedInActivityCard
                        ? "text-neutral-500 dark:text-slate-500 md:text-neutral-600 dark:md:text-slate-400"
                        : "text-neutral-500 dark:text-slate-500"
                  }`}
                >
                  {label}
                </span>
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
    </div>
  );
}
