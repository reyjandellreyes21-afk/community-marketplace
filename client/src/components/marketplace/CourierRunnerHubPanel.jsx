import { CourierPresenceControls } from "./CourierPresenceControls.jsx";

/**
 * Activity → Courier → **Tasks** tab: neighbor card + open deliveries (availability toggles live in hub chrome).
 *
 * @param {{
 *   courierPresence: import("../../hooks/useCourierPresence.js").useCourierPresence,
 *   onOrdersRefresh?: () => void | Promise<void>,
 *   courierProfileReady?: boolean,
 *   courierProfileMissing?: string[],
 *   onCourierCompleteProfile?: () => void,
 *   onCourierHubOpenTaskCount?: (count: number) => void,
 * }} props
 */
export function CourierRunnerHubPanel({
  courierPresence,
  onOrdersRefresh,
  courierProfileReady = true,
  courierProfileMissing = [],
  onCourierCompleteProfile,
  onCourierHubOpenTaskCount,
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      <CourierPresenceControls
        courierPresence={courierPresence}
        onOrdersRefresh={onOrdersRefresh}
        courierProfileReady={courierProfileReady}
        courierProfileMissing={courierProfileMissing}
        onCourierCompleteProfile={onCourierCompleteProfile}
        onCourierHubOpenTaskCount={onCourierHubOpenTaskCount}
        hideAvailabilityRadios
      />
    </div>
  );
}
