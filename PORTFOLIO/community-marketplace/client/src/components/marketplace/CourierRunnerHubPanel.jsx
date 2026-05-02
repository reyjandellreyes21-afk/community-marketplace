import { CourierPresenceControls } from "./CourierPresenceControls.jsx";

/**
 * Activity → Courier → **Find deliveries**: courier availability and open tasks (device push lives in a future app build).
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   onOrdersRefresh?: () => void | Promise<void>,
 *   viewerProfile?: { id: string, displayName?: string, username?: string, avatarUrl?: string } | null,
 * }} props
 */
export function CourierRunnerHubPanel({ token, communityId, onOrdersRefresh, viewerProfile = null }) {
  return (
    <div className="space-y-4 md:space-y-5">
      <CourierPresenceControls
        token={token}
        communityId={communityId}
        onOrdersRefresh={onOrdersRefresh}
        viewerProfile={viewerProfile}
      />
    </div>
  );
}
