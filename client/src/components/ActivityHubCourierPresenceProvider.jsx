import { createContext, useContext } from "react";
import { useCourierPresence } from "../hooks/useCourierPresence.js";

/** @type {import("react").Context<ReturnType<typeof useCourierPresence> | null>} */
const ActivityHubCourierPresenceContext = createContext(null);

export function useActivityHubCourierPresence() {
  const value = useContext(ActivityHubCourierPresenceContext);
  if (!value) {
    throw new Error("useActivityHubCourierPresence must be used within ActivityHubCourierPresenceProvider");
  }
  return value;
}

/**
 * Single courier presence instance for Activity hub (sidebar toggle + Courier panel).
 *
 * @param {{
 *   token: string,
 *   communityId: string,
 *   user: { id?: string, username?: string, avatarUrl?: string, courierStatus?: string } | null,
 *   buyNowFromProfile: { ready: boolean, missing?: string[] },
 *   applyCourierPresenceToUser: (payload: { courierStatus?: string }) => void,
 *   getDisplayNameFromUser: (u: unknown) => string,
 *   children: import("react").ReactNode,
 * }} props
 */
export function ActivityHubCourierPresenceProvider({
  token,
  communityId,
  user,
  buyNowFromProfile,
  applyCourierPresenceToUser,
  getDisplayNameFromUser,
  children,
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

  return (
    <ActivityHubCourierPresenceContext.Provider value={courierPresence}>
      {children}
    </ActivityHubCourierPresenceContext.Provider>
  );
}
