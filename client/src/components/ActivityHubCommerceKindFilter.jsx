import { ACTIVITY_TABS } from "../views.js";

const TAB_BADGE_SLATE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-slate-500 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-slate-600";

const TAB_BADGE_ROSE =
  "pointer-events-none absolute -right-0.5 -top-0.5 z-[1] inline-flex min-h-[1rem] min-w-[1rem] max-w-[min(2.75rem,calc(100%-0.35rem))] items-center justify-center rounded-full bg-rose-600 px-[3px] py-px text-[9px] font-bold leading-none text-white shadow-sm dark:bg-rose-500";

function BagIcon({ className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} width={20} height={20} aria-hidden>
      <path
        d="M8.25 8.25V6.5a3.75 3.75 0 017.5 0v1.75M5.25 9.75h13.5a1.5 1.5 0 011.5 1.5v8.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V11.25a1.5 1.5 0 011.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} width={20} height={20} aria-hidden>
      <path
        d="M7.5 4.5v2.25M16.5 4.5v2.25M4.5 9.75h15M6.75 6h10.5a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V8.25A2.25 2.25 0 016.75 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TruckIcon({ className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className} width={20} height={20} aria-hidden>
      <path
        d="M14.25 16.5h1.5a1.5 1.5 0 001.5-1.5v-3l-2.25-3h-3V16.5zM3 16.5h9.75M5.25 16.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm10.5 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM14.25 9H9.75V4.5H3v12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function badgeCountDisplay(b) {
  const raw = typeof b?.count === "number" ? b.count : 0;
  const count = Math.min(99, Math.max(0, raw));
  return count > 99 ? "99+" : String(count);
}

/**
 * Quick jump row: **All** / **Orders** / **Booking** / **Courier** workspaces (same destinations as `ActivityPrimaryTabs`).
 * Optional `toolbarEnd` appends controls after the courier icon, e.g. list/grid layout.
 *
 * @param {{
 *   showWorkspaceRail?: boolean,
 *   activityTab: string,
 *   goActivity: (tab?: string) => void,
 *   ordersRole: "buyer"|"seller",
 *   ordersWorkspaceRole?: "buyer"|"seller"|null,
 *   buyingBadge?: { count: number, rose?: boolean },
 *   sellingBadge?: { count: number, rose?: boolean },
 *   bookingBadge?: { count: number, rose?: boolean },
 *   courierBadge?: { count: number, rose?: boolean },
 *   courierProfileIncomplete?: boolean,
 *   toolbarEnd?: import("react").ReactNode,
 * }} props
 */
export function ActivityHubCommerceKindFilter({
  showWorkspaceRail = true,
  activityTab,
  goActivity,
  ordersRole,
  ordersWorkspaceRole = null,
  buyingBadge = { count: 0, rose: false },
  sellingBadge = { count: 0, rose: false },
  bookingBadge = { count: 0, rose: false },
  courierBadge = { count: 0, rose: false },
  courierProfileIncomplete = false,
  toolbarEnd = null,
}) {
  const ordersNavBadge = {
    count: Math.min(99, Math.max(0, (buyingBadge?.count || 0) + (sellingBadge?.count || 0))),
    rose: Boolean(buyingBadge?.rose) || Boolean(sellingBadge?.rose),
  };
  const bb = bookingBadge && typeof bookingBadge === "object" ? bookingBadge : { count: 0, rose: false };
  const cb = courierBadge && typeof courierBadge === "object" ? courierBadge : { count: 0, rose: false };

  const roleForOrdersJump = ordersWorkspaceRole || ordersRole;
  const onAllHub = () => goActivity(ACTIVITY_TABS.COMMERCE_ALL);
  const onOrdersHub = () => goActivity(roleForOrdersJump === "seller" ? ACTIVITY_TABS.SELLING : ACTIVITY_TABS.BUYING);
  const onBookingHub = () => goActivity(ACTIVITY_TABS.BOOKING);
  const onCourierHub = () => goActivity(ACTIVITY_TABS.COURIER);

  const activityCommerceAll = activityTab === ACTIVITY_TABS.COMMERCE_ALL;
  const activityBuying = activityTab === ACTIVITY_TABS.BUYING;
  const activitySelling = activityTab === ACTIVITY_TABS.SELLING;
  const activityBooking = activityTab === ACTIVITY_TABS.BOOKING;
  const activityCourier = activityTab === ACTIVITY_TABS.COURIER;

  const allSelected = activityCommerceAll;
  const ordersIconSelected = activityBuying || activitySelling;
  const bookingIconSelected = activityBooking;
  const courierIconSelected = activityCourier;

  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-accent/45 dark:focus-visible:ring-offset-slate-900";

  const pillBase =
    `relative inline-flex min-h-[2.75rem] shrink-0 select-none touch-manipulation items-center justify-center gap-1.5 rounded-full border text-sm font-semibold transition-colors duration-150 ease-out ${focusRing}`;

  /** Selected = one obvious fill; unselected = neutral so only the current workspace reads as active. */
  const styleSelected =
    "border-primary bg-primary text-white shadow-sm dark:border-brand-accent dark:bg-brand-accent";
  const styleUnselected =
    "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200";

  const pillClass = (selected) => (selected ? styleSelected : styleUnselected);

  const allHint =
    "All activity — product orders and service bookings in one workspace with shared status tabs.";
  const ordersHint = "Orders workspace — product purchases and fulfillment only.";
  const bookingHint = "Booking workspace — service listings you booked or that others booked from you.";
  const courierHintBase = "Courier workspace — neighbor deliveries, assignments, and suggestions.";
  const courierHint =
    courierProfileIncomplete
      ? `${courierHintBase} Finish your profile before turning on courier availability.`
      : courierHintBase;

  const ordersCount = badgeCountDisplay(ordersNavBadge);
  const bookingCount = badgeCountDisplay(bb);
  const courierCount = badgeCountDisplay(cb);
  const showOrdersBadge = ordersNavBadge.count > 0;
  const showBookingBadge = bb.count > 0;
  const showCourierBadge = cb.count > 0;

  return (
    <div
      className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-2 md:mt-3"
      role="toolbar"
      aria-label={showWorkspaceRail ? "Activity workspaces" : "Activity sections"}
    >
      {showWorkspaceRail ? (
        <button
          type="button"
          className={`${pillBase} min-w-[4.5rem] px-4 py-2 ${pillClass(allSelected)}`}
          aria-pressed={allSelected}
          aria-current={allSelected ? "true" : undefined}
          title={activityCourier ? `${allHint} Opens the All hub from Courier.` : allHint}
          onClick={onAllHub}
        >
          All
        </button>
      ) : null}

      <button
        type="button"
        className={`${pillBase} min-w-[5.5rem] px-3 py-2 ${pillClass(ordersIconSelected)}`}
        aria-label={showOrdersBadge ? `Orders, ${ordersCount}` : "Orders"}
        aria-pressed={ordersIconSelected}
        aria-current={ordersIconSelected ? "true" : undefined}
        title={ordersHint}
        onClick={onOrdersHub}
      >
        <BagIcon className="size-5 shrink-0" />
        <span>Orders</span>
        {showOrdersBadge ? (
          <span className={ordersNavBadge.rose ? TAB_BADGE_ROSE : TAB_BADGE_SLATE} aria-hidden>
            {ordersCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className={`${pillBase} min-w-[5.75rem] px-3 py-2 ${pillClass(bookingIconSelected)}`}
        aria-label={showBookingBadge ? `Booking, ${bookingCount}` : "Booking"}
        aria-pressed={bookingIconSelected}
        aria-current={bookingIconSelected ? "true" : undefined}
        title={bookingHint}
        onClick={onBookingHub}
      >
        <CalendarIcon className="size-5 shrink-0" />
        <span>Booking</span>
        {showBookingBadge ? (
          <span className={bb.rose ? TAB_BADGE_ROSE : TAB_BADGE_SLATE} aria-hidden>
            {bookingCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className={`${pillBase} min-w-[5.75rem] px-3 py-2 ${pillClass(courierIconSelected)}`}
        aria-label={showCourierBadge ? `Courier, ${courierCount}` : "Courier"}
        aria-pressed={courierIconSelected}
        aria-current={courierIconSelected ? "true" : undefined}
        title={courierHint}
        onClick={onCourierHub}
      >
        <TruckIcon className="size-5 shrink-0" />
        <span>Courier</span>
        {showCourierBadge ? (
          <span className={cb.rose ? TAB_BADGE_ROSE : TAB_BADGE_SLATE} aria-hidden>
            {courierCount}
          </span>
        ) : null}
      </button>

      {toolbarEnd ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{toolbarEnd}</div>
      ) : null}
    </div>
  );
}
