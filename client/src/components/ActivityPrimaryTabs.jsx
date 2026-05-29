import { ACTIVITY_ORDERS_TAB_ID } from "../lib/activityTabTheme.js";
import { ACTIVITY_TABS } from "../views.js";
import { ActivityPrimaryTabGlyph } from "./ActivityPrimaryTabGlyph.jsx";

const TAB_BADGE_SLATE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-slate-500 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-slate-600";

const TAB_BADGE_ROSE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-rose-600 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-rose-500";

/**
 * All / Orders / Booking / Courier — four primary workspaces. **All** merges purchases + bookings;
 * **Orders** is products & fulfillment only (Buying / Selling); **Booking** is service bookings.
 *
 * @param {{ count: number, rose?: boolean }} [props.buyingBadge]
 * @param {{ count: number, rose?: boolean }} [props.sellingBadge]
 * @param {{ count: number, rose?: boolean }} [props.bookingBadge]
 * @param {{ count: number, rose?: boolean }} [props.courierBadge]
 * @param {boolean} [props.embedInActivityCard] When true, strip outer shell inset (desktop card layout)
 * @param {boolean} [props.desktopSidebar] When true, vertical rail (md+ Activity hub only — parent should not render on mobile)
 * @param {boolean} [props.courierProfileIncomplete] Courier tab tooltip when profile lacks required fields for runs
 * @param {"buyer"|"seller"} [props.ordersRole] Preferred Orders sub-view when entering the Orders tab
 */
export function ActivityPrimaryTabs({
  activityTab,
  goActivity,
  buyingBadge = { count: 0, rose: false },
  sellingBadge = { count: 0, rose: false },
  bookingBadge = { count: 0, rose: false },
  courierBadge = { count: 0, rose: false },
  embedInActivityCard = false,
  desktopSidebar = false,
  courierProfileIncomplete = false,
  ordersRole = "buyer",
}) {
  const bb = bookingBadge && typeof bookingBadge === "object" ? bookingBadge : { count: 0, rose: false };
  const allWorkspaceBadge = {
    count: Math.min(
      99,
      Math.max(0, (buyingBadge?.count || 0) + (sellingBadge?.count || 0) + (bb.count || 0)),
    ),
    rose: Boolean(buyingBadge?.rose) || Boolean(sellingBadge?.rose) || Boolean(bb.rose),
  };
  const ordersBadge = {
    count: Math.min(99, Math.max(0, (buyingBadge?.count || 0) + (sellingBadge?.count || 0))),
    rose: Boolean(buyingBadge?.rose) || Boolean(sellingBadge?.rose),
  };
  const tabs = [
    {
      id: ACTIVITY_TABS.COMMERCE_ALL,
      label: "All",
      hint: "Everything in one place — product orders and service bookings share the same status tabs here.",
      badge: allWorkspaceBadge,
    },
    {
      id: ACTIVITY_ORDERS_TAB_ID,
      label: "Orders",
      hint: "Product orders only — what you bought and what buyers ordered from your listings.",
      badge: ordersBadge,
    },
    {
      id: ACTIVITY_TABS.BOOKING,
      label: "Booking",
      hint: "Service bookings you placed and bookings on your listings, together in one place.",
      badge: bookingBadge,
    },
    {
      id: ACTIVITY_TABS.COURIER,
      label: "Courier",
      badge: courierBadge,
      hint: "Neighbor deliveries, assignments, and suggestions.",
    },
  ];

  const isOrdersTab = (id) => id === ACTIVITY_ORDERS_TAB_ID;
  const isAllWorkspaceTab = (id) => id === ACTIVITY_TABS.COMMERCE_ALL;
  const tabSelected = (id) => {
    if (isAllWorkspaceTab(id)) return activityTab === ACTIVITY_TABS.COMMERCE_ALL;
    if (isOrdersTab(id))
      return activityTab === ACTIVITY_TABS.BUYING || activityTab === ACTIVITY_TABS.SELLING;
    return activityTab === id;
  };
  const onActivateTab = (id) => {
    if (isAllWorkspaceTab(id)) {
      goActivity(ACTIVITY_TABS.COMMERCE_ALL);
      return;
    }
    if (!isOrdersTab(id)) {
      goActivity(id);
      return;
    }
    goActivity(ordersRole === "seller" ? ACTIVITY_TABS.SELLING : ACTIVITY_TABS.BUYING);
  };
  const orderedIds = [ACTIVITY_TABS.COMMERCE_ALL, ACTIVITY_ORDERS_TAB_ID, ACTIVITY_TABS.BOOKING, ACTIVITY_TABS.COURIER];

  const tabListClass = desktopSidebar
    ? "flex w-full min-w-0 flex-col gap-1"
    : embedInActivityCard
      ? "flex w-full min-w-0 flex-wrap justify-center gap-0.5 md:flex-nowrap md:gap-2 md:px-0"
      : "grid w-full min-w-0 grid-cols-4 gap-0 max-md:shadow-none md:w-auto md:min-w-[min(22rem,calc(100vw-2rem))] md:max-w-[32rem] md:gap-0.5 md:rounded-2xl md:border md:border-neutral-200/90 md:bg-white/95 md:p-1 md:shadow-[0_8px_30px_-14px_rgba(15,23,42,0.18)] md:dark:border-slate-600 md:dark:bg-slate-900/92 md:dark:shadow-[0_12px_36px_-16px_rgba(0,0,0,0.55)]";

  const outerWrapClass = desktopSidebar
    ? "flex w-full min-w-0 justify-stretch py-0"
    : embedInActivityCard
      ? "flex w-full min-w-0 justify-center py-0"
      : "app-shell-content-inset flex w-full min-w-0 justify-center py-1.5 md:py-2.5";

  const sidebarSelectedBorder = "border-primary dark:border-brand-accent";
  const selectedLabelClass = "text-primary dark:text-brand-accent";
  const selectedGlyphClass = "text-primary dark:text-brand-accent";
  const selectedBarClass = "bg-primary dark:bg-brand-accent";

  return (
    <div className={outerWrapClass}>
      <div
        className={tabListClass}
        role="tablist"
        aria-label="Orders sections"
        aria-orientation={desktopSidebar ? "vertical" : undefined}
        onKeyDown={(e) => {
          const ids = orderedIds;
          const { key } = e;
          const vertical = desktopSidebar;
          const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
          const nextKey = vertical ? "ArrowDown" : "ArrowRight";
          if (key !== prevKey && key !== nextKey && key !== "Home" && key !== "End") return;
          e.preventDefault();
          const currentId =
            activityTab === ACTIVITY_TABS.COMMERCE_ALL
              ? ACTIVITY_TABS.COMMERCE_ALL
              : activityTab === ACTIVITY_TABS.BUYING || activityTab === ACTIVITY_TABS.SELLING
                ? ACTIVITY_ORDERS_TAB_ID
                : activityTab;
          const idxRaw = ids.indexOf(currentId);
          const idx = idxRaw >= 0 ? idxRaw : 0;
          let next = idx;
          if (key === nextKey) next = Math.min(ids.length - 1, idx + 1);
          else if (key === prevKey) next = Math.max(0, idx - 1);
          else if (key === "Home") next = 0;
          else if (key === "End") next = ids.length - 1;
          if (next !== idx) {
            const nextId = ids[next];
            onActivateTab(nextId);
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
        const selected = tabSelected(id);
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
            ? "!bg-primary-soft/95 !text-primary !ring-1 !ring-inset !ring-primary/35 max-md:!bg-brand-primary/12 max-md:!ring-0 dark:!bg-slate-800/80 dark:!text-brand-accent dark:!ring-brand-accent/30 dark:max-md:!bg-brand-accent/15"
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
              ? `${sidebarSelectedBorder} bg-primary-soft/75 dark:bg-slate-800/65`
              : "border-transparent hover:bg-primary-soft/40 dark:hover:bg-slate-800/45"
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
              onClick={() => onActivateTab(id)}
            >
              <span className="relative inline-flex shrink-0">
                <ActivityPrimaryTabGlyph
                  tabId={id}
                  selected={selected}
                  selectedAccentClass={selectedGlyphClass}
                />
                {showBadge ? (
                  <span className={rose ? TAB_BADGE_ROSE : TAB_BADGE_SLATE} aria-hidden>
                    {countDisplay}
                  </span>
                ) : null}
              </span>
              <span
                className={`min-w-0 flex-1 text-xs font-semibold leading-tight ${
                  selected ? selectedLabelClass : "text-neutral-600 dark:text-slate-400"
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
            onClick={() => onActivateTab(id)}
          >
            <span className="flex w-full min-w-0 flex-col items-center gap-1">
              <span className="flex w-full min-w-0 flex-col items-center gap-1">
                <span className="relative inline-flex shrink-0">
                  <ActivityPrimaryTabGlyph
                    tabId={id}
                    selected={selected}
                    selectedAccentClass={selectedGlyphClass}
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
                      ? selectedLabelClass
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
                  selected ? `${selectedBarClass} opacity-100` : "opacity-0"
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
