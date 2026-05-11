import { ACTIVITY_TABS } from "../views.js";
import { ORDERS_STATUS_TABS, BOOKING_STATUS_TABS } from "../lib/orderAttentionStorage.js";
import { getActivityTabChrome } from "../lib/activityTabTheme.js";

const ORDER_STATUS_BADGE_MUTED =
  "inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-slate-500 px-[5px] py-px text-[9px] font-bold tabular-nums leading-none text-white shadow-sm dark:bg-slate-600";
const ORDER_STATUS_BADGE_ROSE =
  "inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-600 px-[5px] py-px text-[9px] font-bold tabular-nums leading-none text-white shadow-sm dark:bg-rose-500";
const ORDER_STATUS_BADGE_CORNER =
  "pointer-events-none absolute right-0.5 top-0.5 z-[1] max-md:right-px max-md:top-px md:right-1 md:top-1";
const ORDER_STATUS_BADGE_MOBILE =
  "max-md:min-h-[1rem] max-md:min-w-[1rem] max-md:px-[3px] max-md:text-[8px]";
/**
 * Pending–Cancelled status filters (purchases & product orders), or **Active / Past / Declined** for bookings.
 * @param {boolean} [props.activityBooking] Service / booking order list (sky status chips)
 * @param {'default'|'desktopMerged'} [props.variant] `desktopMerged` = minimal outer shell (row sits inside unified Activity toolbar on md+)
 * @param {'center'|'start'} [props.desktopRowJustify] Horizontal alignment for `desktopMerged` status tabs (web sidebar layout uses `start`)
 * @param {string} [props.bookingOrdersStatusTab] When `activityBooking`: `active` | `past` | `declined`
 * @param {(id: string) => void} [props.commitBookingOrdersStatusTab]
 * @param {number} [props.bookingActiveTabBadgeDisplayCount]
 * @param {number} [props.bookingPastTabBadgeDisplayCount]
 * @param {number} [props.bookingDeclinedTabBadgeDisplayCount]
 */
export function ActivityHubOrderStatusStrip({
  activityBuying,
  activityBooking = false,
  activityTab,
  ordersStatusTab,
  commitOrdersStatusTab,
  pendingTabBadgeDisplayCount,
  processingTabBadgeDisplayCount,
  ordersTabBadgeIdsByTab,
  bookingOrdersStatusTab = "active",
  commitBookingOrdersStatusTab,
  bookingActiveTabBadgeDisplayCount = 0,
  bookingPastTabBadgeDisplayCount = 0,
  bookingDeclinedTabBadgeDisplayCount = 0,
  variant = "default",
  desktopRowJustify = "center",
}) {
  const activityTabChrome = getActivityTabChrome(activityTab);
  const sellingChrome = activityTab === ACTIVITY_TABS.SELLING;
  const bookingChrome = Boolean(activityBooking) || activityTab === ACTIVITY_TABS.BOOKING;
  const chipSelected = bookingChrome
    ? "max-md:border-sky-400/55 max-md:bg-sky-50 max-md:text-sky-950 dark:max-md:border-sky-500/45 dark:max-md:bg-sky-950/45 dark:max-md:text-sky-100"
    : sellingChrome
      ? "max-md:border-amber-400/55 max-md:bg-amber-50 max-md:text-amber-950 dark:max-md:border-amber-500/45 dark:max-md:bg-amber-950/45 dark:max-md:text-amber-100"
      : "max-md:border-emerald-400/55 max-md:bg-emerald-50 max-md:text-emerald-950 dark:max-md:border-emerald-500/45 dark:max-md:bg-emerald-950/45 dark:max-md:text-emerald-100";
  const chipUnselected =
    "max-md:border-neutral-200/80 max-md:bg-neutral-50 max-md:text-neutral-600 dark:max-md:border-slate-600/80 dark:max-md:bg-slate-900/60 dark:max-md:text-slate-300";

  const stripOuterClass =
    variant === "desktopMerged"
      ? "relative w-full min-w-0"
      : "relative mt-2 md:mt-4 max-md:sticky max-md:z-30 max-md:border-t border-neutral-200/70 bg-neutral-50/95 pb-1 pt-1 shadow-[0_-6px_18px_-10px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-950/95 dark:shadow-[0_-6px_22px_-10px_rgba(0,0,0,0.35)] max-md:bottom-[calc(env(safe-area-inset-bottom,0px)+var(--activity-primary-footer,4.75rem)+0.25rem)] md:rounded-xl md:border md:border-neutral-200/75 md:bg-white md:px-2 md:pb-2 md:pt-2 md:shadow-sm md:shadow-slate-900/[0.04] md:backdrop-blur-none dark:md:border-slate-600/90 dark:md:bg-slate-900/85 dark:md:shadow-none";

  const mergedJustify =
    variant === "desktopMerged"
      ? desktopRowJustify === "start"
        ? "justify-start"
        : "justify-center"
      : "";
  const statusTabListClass =
    variant === "desktopMerged"
      ? `mx-auto flex w-full min-w-0 flex-wrap gap-2 md:flex-nowrap md:gap-2 md:px-0 ${mergedJustify}`
      : activityBooking
        ? "mx-auto grid w-full min-w-0 grid-cols-3 gap-1 md:flex md:w-fit md:max-w-full md:flex-nowrap md:justify-center md:gap-2 md:px-1"
        : "mx-auto grid w-full min-w-0 grid-cols-4 gap-1 md:flex md:w-fit md:max-w-full md:flex-nowrap md:justify-center md:gap-2 md:px-1";

  const statusTabMdSizing =
    variant === "desktopMerged"
      ? "md:flex md:min-h-[2.5rem] md:min-w-[5.25rem] md:max-w-[9rem] md:flex-none md:flex-col md:items-center md:justify-center md:rounded-lg md:px-3 md:py-2 md:text-center md:transition-colors md:duration-150 md:ease-out min-[380px]:md:px-3.5"
      : "md:flex md:min-h-[2.5rem] md:min-w-[5.25rem] md:max-w-[9rem] md:flex-none md:flex-col md:items-center md:justify-center md:rounded-lg md:px-3 md:py-2 md:text-center md:transition-colors md:duration-150 md:ease-out min-[380px]:md:px-3.5";

  const statusTabs = activityBooking ? BOOKING_STATUS_TABS : ORDERS_STATUS_TABS;
  const selectedId = activityBooking ? bookingOrdersStatusTab : ordersStatusTab;
  const commitTab = activityBooking ? commitBookingOrdersStatusTab : commitOrdersStatusTab;

  return (
    <div className={stripOuterClass}>
      <div
        className={statusTabListClass}
        role="tablist"
        aria-label={activityBuying ? "Purchase status" : bookingChrome ? "Booking status" : "Order status"}
        onKeyDown={(e) => {
          const tabs = statusTabs;
          const { key } = e;
          if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;
          e.preventDefault();
          const idx = tabs.findIndex((t) => t.id === selectedId);
          let next = idx;
          if (key === "ArrowRight") next = Math.min(tabs.length - 1, idx + 1);
          else if (key === "ArrowLeft") next = Math.max(0, idx - 1);
          else if (key === "Home") next = 0;
          else if (key === "End") next = tabs.length - 1;
          if (next !== idx) {
            const nextId = tabs[next].id;
            commitTab?.(nextId);
            queueMicrotask(() => {
              document.getElementById(`commerce-flow-status-tab-${nextId}`)?.focus();
            });
          }
        }}
      >
        {statusTabs.map(({ id, label, hint }) => {
          const selected = selectedId === id;
          let tabBadgeCount = 0;
          let unseenForStatusTab = 0;
          if (activityBooking) {
            if (id === "active") {
              tabBadgeCount = bookingActiveTabBadgeDisplayCount;
              unseenForStatusTab =
                (ordersTabBadgeIdsByTab.pending?.length ?? 0) + (ordersTabBadgeIdsByTab.processing?.length ?? 0);
            } else if (id === "past") {
              tabBadgeCount = bookingPastTabBadgeDisplayCount;
              unseenForStatusTab = ordersTabBadgeIdsByTab.completed?.length ?? 0;
            } else if (id === "declined") {
              tabBadgeCount = bookingDeclinedTabBadgeDisplayCount;
              unseenForStatusTab = ordersTabBadgeIdsByTab.cancelled?.length ?? 0;
            }
          } else if (id === "pending") {
            tabBadgeCount = pendingTabBadgeDisplayCount;
            unseenForStatusTab = ordersTabBadgeIdsByTab.pending?.length ?? 0;
          } else if (id === "processing") {
            tabBadgeCount = processingTabBadgeDisplayCount;
            unseenForStatusTab = ordersTabBadgeIdsByTab.processing?.length ?? 0;
          } else if (id === "completed" || id === "cancelled") {
            tabBadgeCount = ordersTabBadgeIdsByTab[id]?.length ?? 0;
            unseenForStatusTab = ordersTabBadgeIdsByTab[id]?.length ?? 0;
          }
          const showTabBadge = tabBadgeCount > 0;
          const badgeIsRose =
            activityBooking
              ? id === "past" || id === "declined"
                ? tabBadgeCount > 0
                : unseenForStatusTab > 0
              : id === "completed" || id === "cancelled"
                ? tabBadgeCount > 0
                : unseenForStatusTab > 0;
          const badgeCountDisplay = tabBadgeCount > 99 ? "99+" : tabBadgeCount;
          return (
            <button
              key={id}
              id={`commerce-flow-status-tab-${id}`}
              type="button"
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls="commerce-flow-status-panel"
              title={hint}
              aria-label={showTabBadge ? `${label}, ${String(badgeCountDisplay).replace("+", " plus ")}` : label}
              className={`relative overflow-visible max-md:flex max-md:min-h-[2.25rem] max-md:w-full max-md:min-w-0 max-md:items-center max-md:justify-center max-md:rounded-none max-md:border max-md:px-1 max-md:py-1.5 max-md:transition-colors ${statusTabMdSizing} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-950 ${
                selected
                  ? `${chipSelected} md:border-0 md:bg-transparent`
                  : `${chipUnselected} md:hover:bg-neutral-50/90 dark:md:hover:bg-slate-900/70`
              }`}
              onClick={() => commitTab?.(id)}
            >
              <span className="flex w-full min-w-0 flex-col items-center justify-center gap-1">
                <span className="flex w-full min-w-0 max-w-full items-center justify-center px-0.5 max-md:px-0">
                  <span
                    className={`min-w-0 text-center max-md:truncate max-md:text-[10px] max-md:font-medium max-md:leading-none md:text-[11px] md:font-semibold md:leading-tight md:whitespace-nowrap ${
                      variant === "desktopMerged" ? "" : "w-full truncate"
                    } ${selected ? activityTabChrome.labelSelected : "text-neutral-600 dark:text-slate-400"}`}
                  >
                    <span className="max-md:inline md:inline">{label}</span>
                  </span>
                </span>
                <span
                  className={`mt-0.5 hidden h-[3px] w-9 shrink-0 rounded-full transition-opacity duration-150 ease-out motion-reduce:transition-none md:block ${
                    selected ? `${activityTabChrome.barSelected} opacity-100` : "opacity-0"
                  }`}
                  aria-hidden
                />
              </span>
              {showTabBadge ? (
                <span
                  className={`${ORDER_STATUS_BADGE_CORNER} ${ORDER_STATUS_BADGE_MOBILE} ${
                    badgeIsRose ? ORDER_STATUS_BADGE_ROSE : ORDER_STATUS_BADGE_MUTED
                  }`}
                  aria-hidden
                >
                  {badgeCountDisplay}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
