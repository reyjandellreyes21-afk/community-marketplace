import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { ACTIVITY_TABS } from "../../views.js";
import { persistCourierModesToProfile } from "../../lib/courierProfileModesApi.js";
import { defaultClaimModeFromProfile, MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";
import { CourierPublicProfileContent } from "./CourierPublicProfileContent.jsx";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

const SAVE_FEEDBACK = {
  offline: "Listing paused — neighbors won’t suggest you until you resume.",
  available: "You’re listed for deliveries — check open tasks below.",
  active: "Still listed — tasks below.",
  busy: "You’re on a delivery — finish up when you can.",
};

/** Must match server `ALLOWED_COURIER_OPTIONAL_TAGS` and neighbor list labels in `CommunityCourierPanel`. */
const COURIER_OPTIONAL_TAG_OPTIONS = [
  { id: "eco", label: "Eco" },
  { id: "bike", label: "Cycling" },
  { id: "fast", label: "Fast" },
  { id: "helping", label: "Helping" },
];

const OPTIONAL_TAG_IDS = new Set(COURIER_OPTIONAL_TAG_OPTIONS.map((o) => o.id));

function normalizeCourierOptionalTags(raw) {
  return [
    ...new Set(
      (Array.isArray(raw) ? raw : [])
        .map((t) => String(t || "").trim().toLowerCase())
        .filter((t) => OPTIONAL_TAG_IDS.has(t)),
    ),
  ];
}

function presenceHint(status) {
  if (status === "offline") return "Listing paused — no neighbor delivery tasks.";
  if (status === "busy") return "On a run — finish it, then pause listing when you’re free.";
  if (status === "active") return "Listed — neighbors can suggest you; tasks below.";
  return "";
}

/** Paused / not listed — circle-ban reads faster than moon vs sun. */
function ListingPausedIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 14.14 14.14" />
    </svg>
  );
}

/** Delivery truck — clearly “courier / deliveries available”. */
function DeliveriesListedIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

/**
 * Segmented listing controls: paused = slate fill, deliveries = emerald fill; inactive = outline.
 *
 * @param {{
 *   groupId: string,
 *   hintId: string,
 *   describeHint: boolean,
 *   className?: string,
 *   isOn: boolean,
 *   saving: boolean,
 *   availabilityLocked: boolean,
 *   canTurnOn: boolean,
 *   saveStatus: (next: string) => void | Promise<void>,
 * }} props
 */
function CourierAvailabilityRadios({
  groupId,
  hintId,
  describeHint,
  className,
  isOn,
  saving,
  availabilityLocked,
  canTurnOn = true,
  saveStatus,
}) {
  const legendId = `${groupId}-legend`;
  return (
    <>
      <p id={legendId} className="sr-only">
        Pause or resume your listing for neighbor delivery tasks
      </p>
      <div
        className={cn("flex flex-wrap items-center gap-2", className)}
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={describeHint ? hintId : undefined}
      >
        <Button
          type="button"
          variant="ghost"
          role="radio"
          aria-checked={!isOn}
          size="compact"
          className={cn(
            "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
            !isOn
              ? "!border !border-slate-700 !bg-slate-800 !text-white shadow-sm hover:!bg-slate-900 dark:!border-slate-400 dark:!bg-slate-500 dark:hover:!bg-slate-400"
              : "!border !border-slate-300 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-200 dark:hover:!bg-slate-800",
          )}
          disabled={saving || availabilityLocked}
          onClick={() => saveStatus("offline")}
          title={
            availabilityLocked
              ? "Finish your active delivery before pausing your listing."
              : "Pause listing — you won’t appear in Neighbor couriers or receive open tasks."
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            <ListingPausedIcon className="h-4 w-4 shrink-0 opacity-95" />
            <span className="text-left leading-tight">Pause listing</span>
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          role="radio"
          aria-checked={isOn}
          size="compact"
          className={cn(
            "!min-h-10 shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45",
            isOn
              ? "!border !border-emerald-600 !bg-emerald-600 !text-white shadow-sm hover:!bg-emerald-700 dark:!border-emerald-400 dark:!bg-emerald-500 dark:hover:!bg-emerald-600"
              : "!border !border-emerald-300 !bg-emerald-50 !text-emerald-800 hover:!bg-emerald-100 dark:!border-emerald-800 dark:!bg-emerald-950/30 dark:!text-emerald-100 dark:hover:!bg-emerald-950/50",
          )}
          disabled={saving || availabilityLocked || !canTurnOn}
          onClick={() => saveStatus("available")}
          title={
            availabilityLocked
              ? "Finish your active delivery before changing listing."
              : !canTurnOn
                ? "Complete your profile before listing yourself for deliveries."
                : "List for deliveries — neighbors can suggest you and you’ll see open tasks."
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            <DeliveriesListedIcon className="h-4 w-4 shrink-0 opacity-95" />
            <span className="text-left leading-tight">Take deliveries</span>
          </span>
        </Button>
      </div>
    </>
  );
}

function PresenceLoadingSkeleton() {
  return (
    <div className="mt-4 h-8 animate-pulse rounded-lg bg-violet-200/40 dark:bg-violet-900/40" aria-hidden />
  );
}

/**
 * Minimal Find-deliveries controls: off/on availability + open tasks list.
 *
 * @param {{ token: string, communityId: string, onOrdersRefresh?: () => void | Promise<void>, onPresenceApplied?: (payload: { courierStatus?: string }) => void, viewerProfile?: { id: string, displayName?: string, username?: string, avatarUrl?: string } | null, courierProfileReady?: boolean, courierProfileMissing?: string[], onCourierCompleteProfile?: () => void }} props
 */
export function CourierPresenceControls({
  token,
  communityId,
  onOrdersRefresh,
  onPresenceApplied,
  viewerProfile = null,
  courierProfileReady = true,
  courierProfileMissing = [],
  onCourierCompleteProfile,
}) {
  const [courierStatus, setCourierStatus] = useState("offline");
  /** Kept in sync with API so PATCH doesn’t wipe tags while tags UI is hidden. */
  const [optionalTags, setOptionalTags] = useState([]);
  const [courierModes, setCourierModes] = useState([]);
  const [viewerBadges, setViewerBadges] = useState(/** @type {{ id: string, label: string }[]} */ ([]));
  const [viewerCompleted, setViewerCompleted] = useState(0);
  const [courierAvgRating, setCourierAvgRating] = useState(/** @type {number | null} */ (null));
  const [courierReviewCount, setCourierReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  /** @type {number | null} */
  const [suggestedCompensationCents, setSuggestedCompensationCents] = useState(null);
  const [suggestedPesosDraft, setSuggestedPesosDraft] = useState("");
  const [savingSuggested, setSavingSuggested] = useState(false);
  const [allowTaskNotifications, setAllowTaskNotifications] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const feedbackClearRef = useRef(/** @type {number | null} */ (null));
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const feedbackId = `${groupId}-feedback`;
  const [neighborSettingsOpen, setNeighborSettingsOpen] = useState(false);
  const [claimMode, setClaimMode] = useState("walk");
  const [profileModes, setProfileModes] = useState(/** @type {string[]} */ ([]));
  const [modesLoaded, setModesLoaded] = useState(false);
  /** From GET /delivery/active (child `CourierOpenDeliveries`) — transport recorded for the in-progress run. */
  const [activeRunAssignmentMode, setActiveRunAssignmentMode] = useState(/** @type {string | null} */ (null));

  const selectableModes = useMemo(() => {
    if (profileModes.length > 0) return MODE_ORDER.filter((x) => profileModes.includes(x));
    return [...MODE_ORDER];
  }, [profileModes]);

  const applyPresencePayload = useCallback((d) => {
    if (!d || typeof d !== "object") return;
    setCourierStatus(String(d.courierStatus || "offline"));
    setOptionalTags(normalizeCourierOptionalTags(d.optionalTags));
    setAllowTaskNotifications(d.allowCourierTaskNotifications !== false);
    const sc = d.suggestedCompensationCents;
    if (sc != null && Number.isFinite(Number(sc))) {
      const n = Math.max(0, Math.floor(Number(sc)));
      setSuggestedCompensationCents(n);
      setSuggestedPesosDraft(String(n / 100));
    } else {
      setSuggestedCompensationCents(null);
      setSuggestedPesosDraft("");
    }
    setCourierModes(
      Array.isArray(d.modes) ? d.modes.map((m) => String(m || "").trim().toLowerCase()).filter(Boolean) : [],
    );
    setViewerBadges(Array.isArray(d.badges) ? d.badges : []);
    setViewerCompleted(typeof d.completedDeliveries === "number" ? d.completedDeliveries : 0);
    const ar = d.courierAvgRating;
    setCourierAvgRating(ar != null && Number.isFinite(Number(ar)) ? Number(ar) : null);
    setCourierReviewCount(typeof d.courierReviewCount === "number" && d.courierReviewCount >= 0 ? d.courierReviewCount : 0);
    onPresenceApplied?.(d);
  }, [onPresenceApplied]);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await apiRequest("/me/courier-presence", { token });
      applyPresencePayload(d);
      setNote("");
    } catch {
      setCourierStatus("offline");
      setOptionalTags([]);
      setCourierModes([]);
      setViewerBadges([]);
      setViewerCompleted(0);
      setCourierAvgRating(null);
      setCourierReviewCount(0);
      setAllowTaskNotifications(true);
      setSuggestedCompensationCents(null);
      setSuggestedPesosDraft("");
    } finally {
      setLoading(false);
    }
  }, [token, applyPresencePayload]);

  /** Re-sync listing toggle + busy from server without showing the full presence skeleton (used when open-delivery poll sees a change). */
  const refreshPresenceQuiet = useCallback(async () => {
    if (!token) return;
    try {
      const d = await apiRequest("/me/courier-presence", { token });
      applyPresencePayload(d);
    } catch {
      /* keep current UI; next full refresh or action will recover */
    }
  }, [token, applyPresencePayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token) return undefined;
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") void refreshPresenceQuiet();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token, refreshPresenceQuiet]);

  useEffect(() => {
    return () => {
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
    };
  }, []);

  /** Load saved transport modes whenever signed in — including while listing is paused — so Edit stays usable. */
  useEffect(() => {
    if (!token) {
      setProfileModes([]);
      setModesLoaded(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await apiRequest("/me/courier-modes", { token });
        const raw = Array.isArray(d?.modes)
          ? d.modes.map((x) => String(x || "").toLowerCase()).filter((x) => MODE_ORDER.includes(x))
          : [];
        if (!cancelled) {
          setProfileModes([...new Set(raw)]);
          setClaimMode(defaultClaimModeFromProfile(raw));
          setModesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setProfileModes([]);
          setClaimMode("walk");
          setModesLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectableModes.includes(claimMode)) {
      setClaimMode(selectableModes[0] || "walk");
    }
  }, [selectableModes, claimMode]);

  useEffect(() => {
    if (!neighborSettingsOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setNeighborSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [neighborSettingsOpen]);

  const showSaveFeedback = (statusId) => {
    setSaveFeedback(SAVE_FEEDBACK[statusId] || "");
    if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
    feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
  };

  const saveSuggestedRate = async () => {
    if (!token || courierStatus === "busy") return;
    setNote("");
    const raw = String(suggestedPesosDraft || "").trim();
    let suggestedPayload = null;
    if (raw !== "") {
      const pesos = Number(raw);
      if (!Number.isFinite(pesos) || pesos < 0) {
        setNote("Enter a valid suggested rate in pesos, or leave blank to clear.");
        return;
      }
      suggestedPayload = Math.round(pesos * 100);
    }
    const currentCents =
      suggestedCompensationCents != null && Number.isFinite(Number(suggestedCompensationCents))
        ? Math.max(0, Math.floor(Number(suggestedCompensationCents)))
        : null;
    if (suggestedPayload === currentCents) return;

    setSavingSuggested(true);
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: {
          suggestedCompensationCents: suggestedPayload,
        },
      });
      applyPresencePayload(d);
      setSaveFeedback("Suggested rate saved (reference only).");
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
    } catch (e) {
      setNote(e?.message || "Could not save.");
    } finally {
      setSavingSuggested(false);
    }
  };

  const saveTaskNotifications = async (next) => {
    if (!token) return;
    setSavingNotify(true);
    setNote("");
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: { allowCourierTaskNotifications: next },
      });
      applyPresencePayload(d);
      setSaveFeedback(next ? "Task notifications on." : "Task notifications off.");
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
    } catch (e) {
      setNote(e?.message || "Could not update notifications.");
    } finally {
      setSavingNotify(false);
    }
  };

  const saveStatus = async (next) => {
    if (!token) return;
    const nextNorm = String(next || "").trim().toLowerCase();
    if ((nextNorm === "available" || nextNorm === "active") && !courierProfileReady) {
      setNote("Complete your profile before turning on courier availability.");
      return;
    }
    setSaving(true);
    setNote("");
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: { courierStatus: next, optionalTags },
      });
      applyPresencePayload(d);
      const resolved = String(d.courierStatus || next);
      if (d.note) setNote(String(d.note));
      showSaveFeedback(resolved);
    } catch (e) {
      setNote(e?.message || "Could not update.");
    } finally {
      setSaving(false);
    }
  };

  const onActiveRunMeta = useCallback((meta) => {
    const m = meta?.assignmentMode != null ? String(meta.assignmentMode).trim().toLowerCase() : "";
    setActiveRunAssignmentMode(m || null);
  }, []);

  /** Keeps neighbor preview + GET /communities/.../couriers in sync with `profiles.courier_modes`. */
  const applyPersistedCourierModes = useCallback((normalized) => {
    setProfileModes(normalized);
    setCourierModes(normalized);
  }, []);

  /** Multi-select transport modes for neighbor-facing profile (`courier_modes`). Empty DB means “any”; toggling from full set narrows the list. */
  const toggleProfileMode = useCallback(
    async (m) => {
      const mode = MODE_ORDER.includes(String(m || "").trim().toLowerCase()) ? String(m).trim().toLowerCase() : "walk";
      const base = profileModes.length > 0 ? [...profileModes] : [...MODE_ORDER];
      const has = base.includes(mode);
      let nextModes = has ? base.filter((x) => x !== mode) : [...base, mode].sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b));
      if (nextModes.length === 0) nextModes = [mode];
      if (!token) return;
      try {
        const normalized = await persistCourierModesToProfile(token, nextModes);
        applyPersistedCourierModes(normalized);
        setClaimMode((prev) =>
          normalized.includes(prev) ? prev : defaultClaimModeFromProfile(normalized),
        );
      } catch (e) {
        setNote(e?.message || "Could not save transport modes.");
      }
    },
    [token, profileModes, applyPersistedCourierModes],
  );

  /** Next claim / invitation only — local until Post claim (does not replace profile modes). */
  const selectNextClaimMode = useCallback((m) => {
    const next = MODE_ORDER.includes(String(m || "").trim().toLowerCase()) ? String(m).trim().toLowerCase() : "walk";
    setClaimMode(next);
  }, []);

  const toggleOptionalTag = async (tagId) => {
    if (!token || courierStatus === "busy" || savingTags) return;
    const id = String(tagId || "").trim().toLowerCase();
    const normalized = normalizeCourierOptionalTags(optionalTags);
    const has = normalized.includes(id);
    const next = has ? normalized.filter((t) => t !== id) : [...normalized, id];
    setSavingTags(true);
    setNote("");
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: { optionalTags: next },
      });
      applyPresencePayload(d);
      if (d.note) setNote(String(d.note));
      setSaveFeedback("Badges updated.");
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
      feedbackClearRef.current = window.setTimeout(() => setSaveFeedback(""), 4000);
    } catch (e) {
      setNote(e?.message || "Could not update badges.");
    } finally {
      setSavingTags(false);
    }
  };

  const normalizedOptionalTags = useMemo(() => normalizeCourierOptionalTags(optionalTags), [optionalTags]);

  const neighborPreviewCourier = useMemo(() => {
    if (!viewerProfile || !String(viewerProfile.id || "").trim()) return null;
    const busy = courierStatus === "busy";
    return {
      id: String(viewerProfile.id),
      displayName: viewerProfile.displayName,
      username: viewerProfile.username,
      avatarUrl: viewerProfile.avatarUrl,
      courierStatus,
      optionalTags: normalizedOptionalTags,
      modes: courierModes,
      completedDeliveries: viewerCompleted,
      badges: viewerBadges,
      suggestedCompensationCents,
      runAssignmentMode: busy ? activeRunAssignmentMode : null,
      nextClaimMode: !busy && courierStatus !== "offline" ? claimMode : null,
      courierAvgRating,
      courierReviewCount,
    };
  }, [
    viewerProfile,
    courierStatus,
    normalizedOptionalTags,
    courierModes,
    viewerCompleted,
    viewerBadges,
    suggestedCompensationCents,
    activeRunAssignmentMode,
    claimMode,
    courierAvgRating,
    courierReviewCount,
  ]);

  const courierTransportState = useMemo(
    () => ({
      claimMode,
      setClaimMode,
      profileModes,
      modesLoaded,
    }),
    [claimMode, profileModes, modesLoaded],
  );

  if (!token) return null;

  const isOn = courierStatus !== "offline";
  const availabilityLocked = courierStatus === "busy";
  const availabilityHintText = availabilityLocked
    ? "You’re on an active delivery — finish before pausing listing or changing modes. Busy is set automatically."
    : presenceHint(courierStatus);
  const showAvailabilityHint = Boolean(availabilityHintText);
  /** Hide “next claim” when only one transport mode is enabled — it’s implied. */
  const showNextClaimInSettings = selectableModes.length > 1;

  return (
    <div className="space-y-4">
      {!courierProfileReady ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200/85 bg-amber-50/60 px-3 py-3 dark:border-amber-900/45 dark:bg-amber-950/25"
        >
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Finish your profile to run deliveries</p>
          <p className="mt-1 text-[11px] leading-snug text-amber-900/90 dark:text-amber-200/90">
            Please complete the following required fields:{" "}
            {courierProfileMissing.length ? courierProfileMissing.join(", ") : "contact and address details"}. Save your profile
            before enabling courier availability.
          </p>
          {typeof onCourierCompleteProfile === "function" ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="primary"
                size="compact"
                className={cn("min-h-9 text-[11px] font-semibold", courierChrome.recoveryPrimary)}
                onClick={() => onCourierCompleteProfile()}
              >
                Complete profile
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        {!communityId ? (
          <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
            Join a community on your profile to receive neighbor deliveries.
          </p>
        ) : null}
        {!loading && neighborPreviewCourier ? (
          <div className={cn("mt-3 shadow-sm dark:shadow-none", courierChrome.courierPanelSurface)}>
            {communityId ? (
              <div className="border-b border-violet-200/60 pb-3 dark:border-violet-800/35">
                <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-violet-800/80 dark:text-violet-200/85">
                  Your courier availability
                </p>
                <div className="flex flex-col items-center gap-2">
                  {showAvailabilityHint ? (
                    <p id={hintId} className="text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                      {availabilityHintText}
                    </p>
                  ) : null}
                  <CourierAvailabilityRadios
                    groupId={groupId}
                    hintId={hintId}
                    describeHint={showAvailabilityHint}
                    className="justify-center"
                    isOn={isOn}
                    saving={saving}
                    availabilityLocked={availabilityLocked}
                    canTurnOn={courierProfileReady}
                    saveStatus={saveStatus}
                  />
                </div>
              </div>
            ) : null}
            <div className={communityId ? "pt-3" : undefined}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-violet-800/90 dark:text-violet-200/90">
                  How neighbors see you
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className={cn("min-h-9 shrink-0 px-3 text-[10px] font-semibold", courierChrome.recoverySecondary)}
                  onClick={() => setNeighborSettingsOpen(true)}
                >
                  Edit
                </Button>
              </div>
              <div className="mt-3 border-t border-violet-200/60 pt-3 dark:border-violet-800/35">
                <CourierPublicProfileContent courier={neighborPreviewCourier} variant="inline" />
              </div>
            </div>
          </div>
        ) : null}
        {loading ? (
          <PresenceLoadingSkeleton />
        ) : (
          <>
            {!communityId ? (
              <CourierAvailabilityRadios
                groupId={groupId}
                hintId={hintId}
                describeHint={showAvailabilityHint}
                className="mt-4"
                isOn={isOn}
                saving={saving}
                availabilityLocked={availabilityLocked}
                canTurnOn={courierProfileReady}
                saveStatus={saveStatus}
              />
            ) : !neighborPreviewCourier ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                {showAvailabilityHint ? (
                  <p id={hintId} className="text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                    {availabilityHintText}
                  </p>
                ) : null}
                <CourierAvailabilityRadios
                  groupId={groupId}
                  hintId={hintId}
                  describeHint={showAvailabilityHint}
                  className="justify-center"
                  isOn={isOn}
                  saving={saving}
                  availabilityLocked={availabilityLocked}
                  canTurnOn={courierProfileReady}
                  saveStatus={saveStatus}
                />
              </div>
            ) : null}
            {!communityId && showAvailabilityHint ? (
              <p id={hintId} className="mt-2 text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
                {availabilityHintText}
              </p>
            ) : null}
            {saveFeedback ? (
              <p id={feedbackId} className="mt-1 text-center text-[11px] font-medium text-violet-800 dark:text-violet-200" aria-live="polite">
                {saveFeedback}
              </p>
            ) : null}
          </>
        )}
      </div>

      {!loading ? (
        <>
          {note ? <p className="mb-3 text-[11px] text-neutral-600 dark:text-slate-400">{note}</p> : null}
          <CourierOpenDeliveries
            token={token}
            communityId={communityId}
            courierStatus={courierStatus}
            courierProfileReady={courierProfileReady}
            viewerSuggestedCompensationCents={suggestedCompensationCents}
            courierTransportState={courierTransportState}
            showInlineTransportPicker={false}
            onActiveRunMeta={onActiveRunMeta}
            onClaimed={async () => {
              await refresh();
              if (typeof onOrdersRefresh === "function") await onOrdersRefresh();
            }}
            onDeliveriesLoaded={refreshPresenceQuiet}
          />
        </>
      ) : null}

      {neighborSettingsOpen ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] dark:bg-slate-950/60"
            aria-label="Close settings"
            onClick={() => setNeighborSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${groupId}-neighbor-settings-title`}
            className="relative z-[1] flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-neutral-200/90 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-slate-700">
              <p id={`${groupId}-neighbor-settings-title`} className="text-sm font-semibold text-neutral-900 dark:text-slate-100">
                Neighbor profile settings
              </p>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100/70 dark:text-violet-300 dark:hover:bg-violet-950/55"
                onClick={() => setNeighborSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {modesLoaded ? (
                <div className="space-y-3 rounded-xl border border-violet-200/60 bg-violet-50/50 px-3 py-3 dark:border-violet-800/40 dark:bg-violet-950/30">
                  <div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Transport</p>
                    <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                      Which ways you deliver for neighbors. Tap to turn each mode on or off.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Profile transport modes">
                      {MODE_ORDER.map((m) => {
                        const active = profileModes.length > 0 ? profileModes.includes(m) : true;
                        return (
                          <Button
                            key={m}
                            type="button"
                            variant={active ? "primary" : "secondary"}
                            size="compact"
                            className={cn(
                              "min-h-8 px-2.5 text-[10px]",
                              active ? courierChrome.recoveryPrimary : courierChrome.recoverySecondary,
                            )}
                            disabled={
                              availabilityLocked ||
                              saving ||
                              savingNotify ||
                              savingTags ||
                              savingSuggested
                            }
                            onClick={() => void toggleProfileMode(m)}
                          >
                            {MODE_LABEL[m] ?? m}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {showNextClaimInSettings ? (
                    <div className="border-t border-violet-200/55 pt-3 dark:border-violet-800/35">
                      <p className="text-[10px] font-semibold text-neutral-800 dark:text-slate-200">
                        When you accept a task, record it as
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
                        Only matters while you offer more than one transport mode above.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Next delivery transport mode">
                        {selectableModes.map((m) => (
                          <Button
                            key={m}
                            type="button"
                            variant={claimMode === m ? "primary" : "secondary"}
                            size="compact"
                            className={cn(
                              "min-h-8 px-2.5 text-[10px]",
                              claimMode === m ? courierChrome.recoveryPrimary : courierChrome.recoverySecondary,
                            )}
                            disabled={
                              availabilityLocked ||
                              saving ||
                              savingNotify ||
                              savingTags ||
                              savingSuggested
                            }
                            onClick={() => selectNextClaimMode(m)}
                          >
                            {MODE_LABEL[m] ?? m}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 dark:text-slate-400" role="status">
                  Loading transport settings…
                </p>
              )}

              <div className="rounded-xl border border-neutral-200/80 bg-white/70 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/35">
                <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Profile flair</p>
                <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                  Optional tags on your card (personality, not your vehicle type — that&apos;s Transport above).
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                  {COURIER_OPTIONAL_TAG_OPTIONS.map(({ id: tagId, label }) => {
                    const checked = normalizedOptionalTags.includes(tagId);
                    const tagDisabled = saving || savingTags || availabilityLocked;
                    return (
                      <label
                        key={tagId}
                        className={`inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-800 dark:text-slate-200 ${
                          tagDisabled ? "cursor-not-allowed opacity-60" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
                          checked={checked}
                          disabled={tagDisabled}
                          onChange={() => void toggleOptionalTag(tagId)}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200/80 bg-white/60 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/30">
                <p className="text-xs font-semibold text-neutral-900 dark:text-slate-100">Suggested pay (optional)</p>
                <p className="mt-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                  Reference only for neighbors — not charged automatically and not a bid. Saves when you leave the field.
                </p>
                <label className="mt-2 flex flex-col text-[10px] text-neutral-700 dark:text-slate-300">
                  Amount (₱)
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-0.5 min-h-9 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950"
                    placeholder="e.g. 50"
                    value={suggestedPesosDraft}
                    onChange={(e) => setSuggestedPesosDraft(e.target.value)}
                    onBlur={() => void saveSuggestedRate()}
                    disabled={savingSuggested || courierStatus === "busy"}
                    autoComplete="off"
                  />
                </label>
                {savingSuggested ? (
                  <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-slate-500" aria-live="polite">
                    Saving…
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/40">
                <input
                  id={`${groupId}-modal-notify-tasks`}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
                  checked={allowTaskNotifications}
                  disabled={savingNotify}
                  onChange={(e) => void saveTaskNotifications(e.target.checked)}
                />
                <label htmlFor={`${groupId}-modal-notify-tasks`} className="cursor-pointer text-[11px] leading-snug text-neutral-800 dark:text-slate-200">
                  Task &amp; assignment notifications
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500 dark:text-slate-500">
                    Native apps can hook this up to push later; your token is never shown here.
                  </span>
                </label>
              </div>
            </div>
            <div className="shrink-0 border-t border-neutral-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] dark:border-slate-700">
              <Button
                type="button"
                variant="primary"
                className={`w-full ${courierChrome.recoveryPrimary}`}
                onClick={() => setNeighborSettingsOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
