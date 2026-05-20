import { getBookingStatusTabs, getOrdersStatusTabs } from "../lib/orderAttentionStorage.js";



const PILL_ROSE_SELECTED =

  "pointer-events-none inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-rose-100 px-[5px] py-px text-[10px] font-bold tabular-nums leading-none text-rose-800 dark:bg-rose-900/55 dark:text-rose-100";

const PILL_ROSE_UNSELECTED =

  "pointer-events-none inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-[5px] py-px text-[10px] font-bold tabular-nums leading-none text-white dark:bg-rose-500";

const PILL_SEEN_SELECTED =

  "pointer-events-none inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-slate-200/90 px-[5px] py-px text-[10px] font-bold tabular-nums leading-none text-slate-700 dark:bg-slate-600 dark:text-slate-100";

const PILL_SEEN_UNSELECTED =

  "pointer-events-none inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-slate-500 px-[5px] py-px text-[10px] font-bold tabular-nums leading-none text-white dark:bg-slate-600";



/**

 * Status filters for the Activity hub.

 *

 *  - **Orders** (Buying / Selling): Needs Action / Ongoing / History.

 *  - **Bookings**: same visible STATUS strip as Orders — Needs Action / Ongoing / History;

 *    hints depend on `bookingOrdersRole` (buyer vs provider). History unions completed + cancelled.

 *

 * Tab pills: **rose** = unseen attention; **slate** = seen queue depth (Needs Action / Ongoing only).

 * History shows a pill only while unseen; after dismiss + navigate away the pill is hidden.

 *

 * @param {boolean} [props.activityBooking]

 * @param {"buyer"|"seller"} [props.bookingOrdersRole]

 * @param {'default'|'desktopMerged'} [props.variant]

 * @param {'center'|'start'} [props.desktopRowJustify]

 * @param {string} [props.bookingOrdersStatusTab] `approve` | `active` | `history`

 * @param {(id: string) => void} [props.commitBookingOrdersStatusTab]

 * @param {number} [props.bookingApproveTabBadgeDisplayCount]

 * @param {number} [props.bookingActiveTabBadgeDisplayCount]

 * @param {number} [props.bookingHistoryTabBadgeDisplayCount] Completed + cancelled merged

 */

export function ActivityHubOrderStatusStrip({

  activityBooking = false,

  bookingOrdersRole = "buyer",

  ordersStatusTab,

  commitOrdersStatusTab,

  pendingTabBadgeDisplayCount,

  processingTabBadgeDisplayCount,

  ordersTabBadgeIdsByTab: ordersTabBadgeIdsByTabProp,

  bookingOrdersStatusTab = "approve",

  commitBookingOrdersStatusTab,

  bookingApproveTabBadgeDisplayCount = 0,

  bookingActiveTabBadgeDisplayCount = 0,

  bookingHistoryTabBadgeDisplayCount = 0,

  variant = "default",

  desktopRowJustify = "center",

}) {

  const ordersTabBadgeIdsByTab = ordersTabBadgeIdsByTabProp && typeof ordersTabBadgeIdsByTabProp === "object" ? ordersTabBadgeIdsByTabProp : {};

  const bookingChrome = Boolean(activityBooking);



  const stripOuterClass =

    variant === "desktopMerged"

      ? "relative w-full min-w-0"

      : "relative mt-2 w-full min-w-0 border-b border-neutral-200/80 dark:border-slate-700/70";



  const mergedJustify =

    variant === "desktopMerged"

      ? desktopRowJustify === "start"

        ? "justify-start"

        : "justify-center"

      : "";



  const statusTabListClass =

    variant === "desktopMerged"

      ? `mx-auto flex w-full min-w-0 flex-wrap items-end gap-2 md:flex-nowrap md:gap-3 md:px-0 ${mergedJustify}`

      : "flex w-full min-w-0 flex-nowrap items-end gap-0 px-0";



  const statusTabs = activityBooking ? getBookingStatusTabs(bookingOrdersRole) : getOrdersStatusTabs();

  const selectedId = activityBooking ? bookingOrdersStatusTab : ordersStatusTab;

  const commitTab = activityBooking ? commitBookingOrdersStatusTab : commitOrdersStatusTab;



  const unseenPendingLen = ordersTabBadgeIdsByTab.pending?.length ?? 0;

  const unseenProcessingLen = ordersTabBadgeIdsByTab.processing?.length ?? 0;

  const unseenHistoryLen =

    (ordersTabBadgeIdsByTab.completed?.length ?? 0) + (ordersTabBadgeIdsByTab.cancelled?.length ?? 0);



  return (

    <div className={stripOuterClass}>

      <div

        className={statusTabListClass}

        role="tablist"

        aria-label={bookingChrome ? "Booking status" : "Order status"}

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

        {statusTabs.map(({ id, label, hint, shortLabel }) => {

          const selected = selectedId === id;

          let tabBadgeCount = 0;

          let tabBadgeRose = false;

          if (activityBooking) {

            if (id === "approve") {

              tabBadgeCount = bookingApproveTabBadgeDisplayCount;

              tabBadgeRose = unseenPendingLen > 0;

            } else if (id === "active") {

              tabBadgeCount = bookingActiveTabBadgeDisplayCount;

              tabBadgeRose = unseenProcessingLen > 0;

            } else if (id === "history") {

              tabBadgeCount = bookingHistoryTabBadgeDisplayCount;

              tabBadgeRose = unseenHistoryLen > 0;

              if (!tabBadgeRose) tabBadgeCount = 0;

            }

          } else if (id === "pending") {

            tabBadgeCount = pendingTabBadgeDisplayCount;

            tabBadgeRose = unseenPendingLen > 0;

          } else if (id === "processing") {

            tabBadgeCount = processingTabBadgeDisplayCount;

            tabBadgeRose = unseenProcessingLen > 0;

          } else if (id === "history") {

            tabBadgeCount = unseenHistoryLen;

            tabBadgeRose = unseenHistoryLen > 0;

          } else if (id === "completed" || id === "cancelled") {

            tabBadgeCount = ordersTabBadgeIdsByTab[id]?.length ?? 0;

            tabBadgeRose = tabBadgeCount > 0;

          }

          const showCount = tabBadgeCount > 0;

          const countDisplay = tabBadgeCount > 99 ? "99+" : String(tabBadgeCount);

          const tabLayoutClass =

            variant === "desktopMerged"

              ? "shrink-0 whitespace-nowrap px-0.5"

              : "flex-1 basis-0 min-w-0 px-0.5 text-center";



          const compact = shortLabel && shortLabel !== label;

          const labelRowClass =

            variant === "desktopMerged"

              ? "inline-flex max-w-full min-w-0 items-center justify-center gap-1 whitespace-nowrap"

              : `inline-flex max-w-full min-w-0 items-center justify-center gap-1 ${compact ? "min-[420px]:whitespace-nowrap" : "whitespace-nowrap"}`;



          const countPillClass = tabBadgeRose

            ? selected

              ? PILL_ROSE_SELECTED

              : PILL_ROSE_UNSELECTED

            : selected

              ? PILL_SEEN_SELECTED

              : PILL_SEEN_UNSELECTED;



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

              aria-label={showCount ? `${label}, ${String(countDisplay).replace("+", " plus ")}` : label}

              className={`relative min-h-[2.75rem] pb-2 pt-1 text-sm font-semibold leading-tight transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${tabLayoutClass} ${

                selected

                  ? "text-indigo-600 after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-indigo-600 dark:text-indigo-400 dark:after:bg-indigo-400"

                  : "text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"

              }`}

              onClick={() => commitTab?.(id)}

            >

              <span className={labelRowClass}>

                {variant === "desktopMerged" || !compact ? (

                  <span className="min-w-0 truncate">{label}</span>

                ) : (

                  <>

                    <span className="min-w-0 min-[420px]:hidden">{shortLabel}</span>

                    <span className="hidden min-w-0 min-[420px]:inline truncate">{label}</span>

                  </>

                )}

                {showCount ? (

                  <span className={countPillClass} aria-hidden>

                    {countDisplay}

                  </span>

                ) : null}

              </span>

            </button>

          );

        })}

      </div>

    </div>

  );

}

