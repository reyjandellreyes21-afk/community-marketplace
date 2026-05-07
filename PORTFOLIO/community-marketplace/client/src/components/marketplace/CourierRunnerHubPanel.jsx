import { CourierPresenceControls } from "./CourierPresenceControls.jsx";

/**
 * Activity → Courier → **Tasks** tab: availability and open deliveries (leaderboard under **Stats**, buyer feedback under **Feedback**).
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   onOrdersRefresh?: () => void | Promise<void>,
 *   onPresenceApplied?: (payload: { courierStatus?: string }) => void,
 *   viewerProfile?: { id: string, displayName?: string, username?: string, avatarUrl?: string } | null,
 *   courierProfileReady?: boolean,
 *   courierProfileMissing?: string[],
 *   onCourierCompleteProfile?: () => void,
 * }} props
 */
export function CourierRunnerHubPanel({
  token,
  communityId,
  onOrdersRefresh,
  onPresenceApplied,
  viewerProfile = null,
  courierProfileReady = true,
  courierProfileMissing = [],
  onCourierCompleteProfile,
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      <CourierPresenceControls
        token={token}
        communityId={communityId}
        onOrdersRefresh={onOrdersRefresh}
        onPresenceApplied={onPresenceApplied}
        viewerProfile={viewerProfile}
        courierProfileReady={courierProfileReady}
        courierProfileMissing={courierProfileMissing}
        onCourierCompleteProfile={onCourierCompleteProfile}
      />
    </div>
  );
}
