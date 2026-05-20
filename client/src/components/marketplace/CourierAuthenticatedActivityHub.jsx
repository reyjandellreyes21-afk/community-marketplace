import { Suspense, createElement, useEffect } from "react";
import { ActivityHubCommerceKindFilter } from "../ActivityHubCommerceKindFilter.jsx";
import { useCourierPresence } from "../../hooks/useCourierPresence.js";
import { ACTIVITY_COURIER_SUBTABS } from "../../views.js";
import { CourierHubAvailabilityRoleToggle, CourierHubSectionUnderlineTabs } from "./CourierActivityHubNav.jsx";
import { CourierEngagementBoard } from "./CourierEngagementBoard.jsx";
import { CourierRunnerHubPanel } from "./CourierRunnerHubPanel.jsx";

/**
 * Signed-in Activity → Courier: OFF/ON toggle, **underline** section tabs, workspace jump row (**All** + Orders · Booking · Courier).
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   activityTab: string,
 *   goActivityGuarded: (tab?: string) => void,
 *   ordersRole: "buyer"|"seller",
 *   activityPrimaryBuyingBadge: { count: number, rose?: boolean },
 *   activityPrimarySellingBadge: { count: number, rose?: boolean },
 *   activityPrimaryBookingBadge: { count: number, rose?: boolean },
 *   activityPrimaryCourierBadge: { count: number, rose?: boolean },
 *   courierProfileIncomplete: boolean,
 *   courierHubTasks: boolean,
 *   courierHubStats: boolean,
 *   courierHubFeedback: boolean,
 *   setCourierHubTab: (t: string) => void,
 *   refreshCourierAndOrders: () => void | Promise<void>,
 *   applyCourierPresenceToUser: (payload: { courierStatus?: string }) => void,
 *   buyNowFromProfile: { ready: boolean, missing: string[] },
 *   openProfileEdit: (opts?: { navigateToOwnProfile?: boolean }) => void,
 *   getDisplayNameFromUser: (user: unknown) => string,
 *   user: { id?: string, username?: string, avatarUrl?: string, courierStatus?: string } | null,
 *   LazyCourierBuyerFeedbackList: import("react").ComponentType<{ token: string }>,
 *   onCourierHubOpenTaskCount?: (count: number) => void,
 * }} props
 */
export function CourierAuthenticatedActivityHub({
  token,
  communityId,
  activityTab,
  goActivityGuarded,
  ordersRole,
  activityPrimaryBuyingBadge,
  activityPrimarySellingBadge,
  activityPrimaryBookingBadge,
  activityPrimaryCourierBadge,
  courierProfileIncomplete,
  courierHubTasks,
  courierHubStats,
  courierHubFeedback,
  setCourierHubTab,
  refreshCourierAndOrders,
  applyCourierPresenceToUser,
  buyNowFromProfile,
  openProfileEdit,
  getDisplayNameFromUser,
  user,
  LazyCourierBuyerFeedbackList: CourierBuyerFeedbackLazy,
  onCourierHubOpenTaskCount,
}) {
  const viewerProfile =
    user?.id != null
      ? {
          id: String(user.id),
          username: user.username,
          displayName: getDisplayNameFromUser(user),
          avatarUrl: user.avatarUrl || "",
        }
      : null;

  const courierPresence = useCourierPresence({
    token,
    communityId,
    onPresenceApplied: applyCourierPresenceToUser,
    courierProfileReady: buyNowFromProfile.ready,
    viewerProfile,
    initialCourierStatus: user?.courierStatus ?? null,
  });

  const { isOn, saving, availabilityLocked, saveStatus, loading, saveFeedback } = courierPresence;

  const availabilityHintText = availabilityLocked
    ? "You’re on an active delivery — finish before pausing listing or changing modes. Busy is set automatically."
    : courierPresence.courierStatus === "offline"
      ? ""
      : courierPresence.courierStatus === "busy"
        ? "On a run — finish it, then pause listing when you’re free."
        : courierPresence.courierStatus === "active"
          ? "Listed — neighbors can suggest you; tasks below."
          : "";

  const hubPanelAria =
    courierHubFeedback
      ? "Courier buyer feedback"
      : courierHubStats
        ? "Courier neighborhood stats"
        : "Find deliveries";

  /** Trust local/optimistic status — do not wait on presence fetch before hiding open tasks. */
  const hubBodyOffline = courierPresence.courierStatus === "offline";
  const hubBodyHydrating = loading && !hubBodyOffline;

  useEffect(() => {
    if (!hubBodyOffline || typeof onCourierHubOpenTaskCount !== "function") return;
    onCourierHubOpenTaskCount(0);
  }, [hubBodyOffline, onCourierHubOpenTaskCount]);

  return (
    <>
      <CourierHubAvailabilityRoleToggle
        className="w-full"
        isOn={isOn}
        saving={saving}
        availabilityLocked={availabilityLocked}
        canTurnOn={buyNowFromProfile.ready}
        saveStatus={saveStatus}
        hintText={!loading && availabilityHintText ? availabilityHintText : ""}
      />
      {saveFeedback ? (
        <p className="mt-2 text-center text-[11px] font-medium text-neutral-600 dark:text-slate-400" aria-live="polite">
          {saveFeedback}
        </p>
      ) : null}
      <>
        <CourierHubSectionUnderlineTabs
          courierHubTasks={courierHubTasks}
          courierHubStats={courierHubStats}
          courierHubFeedback={courierHubFeedback}
          onTasks={() => setCourierHubTab(ACTIVITY_COURIER_SUBTABS.TASKS)}
          onStats={() => setCourierHubTab(ACTIVITY_COURIER_SUBTABS.STATS)}
          onFeedback={() => setCourierHubTab(ACTIVITY_COURIER_SUBTABS.FEEDBACK)}
        />
        <ActivityHubCommerceKindFilter
          showWorkspaceRail
          activityTab={activityTab}
          goActivity={goActivityGuarded}
          ordersRole={ordersRole}
          buyingBadge={activityPrimaryBuyingBadge}
          sellingBadge={activityPrimarySellingBadge}
          bookingBadge={activityPrimaryBookingBadge}
          courierBadge={activityPrimaryCourierBadge}
          courierProfileIncomplete={courierProfileIncomplete}
        />
        {hubBodyOffline ? (
          <div
            id="courier-hub-panel"
            role="tabpanel"
            aria-label="Courier availability off"
            className="max-md:pt-2 md:pt-3"
          >
            <p className="py-8 text-center text-sm font-medium text-neutral-600 dark:text-slate-400">
              {"You're offline"}
            </p>
          </div>
        ) : (
          <div
            id="courier-hub-panel"
            role="tabpanel"
            aria-label={hubPanelAria}
            className="space-y-4 max-md:pt-2 md:space-y-6 md:pt-3"
          >
            {courierHubTasks ? (
              hubBodyHydrating ? (
                <div className="py-8 text-center text-sm text-neutral-500 dark:text-slate-400" aria-busy="true">
                  Loading…
                </div>
              ) : (
                <CourierRunnerHubPanel
                  courierPresence={courierPresence}
                  onOrdersRefresh={refreshCourierAndOrders}
                  courierProfileReady={buyNowFromProfile.ready}
                  courierProfileMissing={buyNowFromProfile.missing}
                  onCourierCompleteProfile={() => openProfileEdit({ navigateToOwnProfile: true })}
                  onCourierHubOpenTaskCount={onCourierHubOpenTaskCount}
                />
              )
            ) : courierHubStats ? (
              <>
                {!communityId ? (
                  <p className="text-[11px] text-amber-800 dark:text-amber-200">
                    Join a community on your profile to see neighborhood leaderboard stats.
                  </p>
                ) : null}
                <CourierEngagementBoard token={token} communityId={communityId} />
              </>
            ) : (
              <Suspense fallback={<div className="py-8 text-center text-sm text-neutral-500">Loading…</div>}>
                {createElement(CourierBuyerFeedbackLazy, { token })}
              </Suspense>
            )}
          </div>
        )}
      </>
    </>
  );
}
