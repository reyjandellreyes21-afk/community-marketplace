import { useActivityHubCourierPresence } from "./ActivityHubCourierPresenceProvider.jsx";
import { OrdersRoleToggle } from "./OrdersRoleToggle.jsx";
import { CourierHubAvailabilityRoleToggle } from "./marketplace/CourierActivityHubNav.jsx";

/**
 * md+ Activity hub left rail — context-specific:
 * - All / Orders / Booking: My Orders / My Sales only
 * - Courier: Courier on / off only
 *
 * @param {{
 *   activityCommerceAll: boolean,
 *   activityBooking: boolean,
 *   activityCourier: boolean,
 *   activityTab: string,
 *   ordersRole: "buyer"|"seller",
 *   commerceAllHubRole: "buyer"|"seller",
 *   setCommerceAllHubRole: (r: "buyer"|"seller") => void,
 *   setOrdersRole: (r: "buyer"|"seller") => void,
 *   commitOrdersRoleToggle: (nextActivityTab: string) => void,
 *   ordersRoleBuyerNavBadge: { count: number, rose?: boolean },
 *   ordersRoleSellerNavBadge: { count: number, rose?: boolean },
 *   ordersRoleBookingBuyerNavBadge: { count: number, rose?: boolean },
 *   ordersRoleBookingSellerNavBadge: { count: number, rose?: boolean },
 *   buyNowFromProfile: { ready: boolean, missing?: string[] },
 * }} props
 */
export function ActivityHubDesktopSidebar({
  activityCommerceAll,
  activityBooking,
  activityCourier,
  activityTab,
  ordersRole,
  commerceAllHubRole,
  setCommerceAllHubRole,
  setOrdersRole,
  commitOrdersRoleToggle,
  ordersRoleBuyerNavBadge,
  ordersRoleSellerNavBadge,
  ordersRoleBookingBuyerNavBadge,
  ordersRoleBookingSellerNavBadge,
  buyNowFromProfile,
}) {
  const courierPresence = useActivityHubCourierPresence();
  const { isOn, saving, availabilityLocked, saveStatus, loading, saveFeedback } = courierPresence;

  const availabilityHintText = availabilityLocked
    ? "Finish your active delivery before pausing."
    : courierPresence.courierStatus === "busy"
      ? "On a run — finish before pausing."
      : courierPresence.courierStatus === "active"
        ? "Listed for neighbor deliveries."
        : "";

  const showCommerceRole = !activityCourier;
  const showCourierAvailability = activityCourier;

  return (
    <aside
      className="hidden min-h-0 w-full shrink-0 border-neutral-200/70 dark:border-slate-700/70 md:flex md:flex-col md:border-r md:pr-4"
      aria-label={showCourierAvailability ? "Courier availability" : "Orders role"}
    >
      {showCommerceRole && activityCommerceAll ? (
        <OrdersRoleToggle
          desktopSidebar
          role={commerceAllHubRole}
          onRoleChange={setCommerceAllHubRole}
          ariaLabel="All activity hub — my orders vs my sales"
          buyerLabel="My Orders"
          sellerLabel="My Sales"
          buyingBadge={ordersRoleBuyerNavBadge}
          sellingBadge={ordersRoleSellerNavBadge}
        />
      ) : showCommerceRole && activityBooking ? (
        <OrdersRoleToggle
          desktopSidebar
          role={ordersRole}
          onRoleChange={setOrdersRole}
          ariaLabel="Orders and bookings role"
          buyerLabel="My Orders"
          sellerLabel="My Sales"
          buyingBadge={ordersRoleBookingBuyerNavBadge}
          sellingBadge={ordersRoleBookingSellerNavBadge}
        />
      ) : showCommerceRole ? (
        <OrdersRoleToggle
          desktopSidebar
          activityTab={activityTab}
          onChange={(nextTab) => commitOrdersRoleToggle(nextTab)}
          buyerLabel="My Orders"
          sellerLabel="My Sales"
          buyingBadge={ordersRoleBuyerNavBadge}
          sellingBadge={ordersRoleSellerNavBadge}
        />
      ) : null}

      {showCourierAvailability ? (
        <>
          <CourierHubAvailabilityRoleToggle
            desktopSidebar
            isOn={isOn}
            saving={saving}
            availabilityLocked={availabilityLocked}
            canTurnOn={buyNowFromProfile.ready}
            saveStatus={saveStatus}
            hintText={!loading && availabilityHintText ? availabilityHintText : ""}
          />
          {saveFeedback ? (
            <p className="mt-2 px-2.5 text-[10px] font-medium text-neutral-600 dark:text-slate-400" aria-live="polite">
              {saveFeedback}
            </p>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
