import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { ACTIVITY_TABS } from "../../views.js";
import { defaultClaimModeFromProfile, MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";
import { CourierEngagementBoard } from "./CourierEngagementBoard.jsx";
import { CourierPublicProfileContent } from "./CourierPublicProfileContent.jsx";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

/** Idle chip style for compact Off/On (aligned with Edit `secondary compact`). */
const courierStatusIdle =
  "rounded-lg border-0 bg-white/90 py-1.5 text-[10px] font-semibold text-violet-900 shadow-sm ring-1 ring-violet-200/60 transition hover:bg-white dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-700/50 dark:hover:bg-violet-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45";

const SAVE_FEEDBACK = {
  offline: "You’re off.",
  available: "You’re on — check open tasks below.",
  active: "Still on — tasks below.",
  busy: "You’re on a delivery — finish up when you can.",
};

/** Must match server `ALLOWED_COURIER_OPTIONAL_TAGS` and neighbor list labels in `CommunityCourierPanel`. */
const COURIER_OPTIONAL_TAG_OPTIONS = [
  { id: "eco", label: "Eco" },
  { id: "bike", label: "Bike" },
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
  if (status === "offline") return "Off — no delivery tasks.";
  if (status === "busy") return "On a run — finish it, then turn off when you’re free.";
  if (status === "active") return "On — neighbors can match you; tasks below.";
  return "";
}

function MoonOffIcon({ className }) {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunOnIcon({ className }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/**
 * @param {{
 *   groupId: string,
 *   hintId: string,
 *   describeHint: boolean,
 *   className?: string,
 *   isOn: boolean,
 *   saving: boolean,
 *   availabilityLocked: boolean,
 *   saveStatus: (next: string) => void | Promise<void>,
 *   courierChrome: { recoveryPrimary: string },
 *   courierStatusIdle: string,
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
  saveStatus,
  courierChrome,
  courierStatusIdle,
}) {
  const legendId = `${groupId}-legend`;
  return (
    <>
      <p id={legendId} className="sr-only">
        Courier availability
      </p>
      <div
        className={cn("flex flex-wrap items-center gap-1.5", className)}
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={describeHint ? hintId : undefined}
      >
        <Button
          type="button"
          variant={!isOn ? "primary" : "ghost"}
          role="radio"
          aria-checked={!isOn}
          size="compact"
          className={cn(
            "!min-h-8 shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold",
            !isOn ? courierChrome.recoveryPrimary : courierStatusIdle,
          )}
          disabled={saving || availabilityLocked}
          onClick={() => saveStatus("offline")}
          title={availabilityLocked ? "Finish your active delivery before going offline." : undefined}
        >
          <span className="inline-flex items-center justify-center gap-1">
            <MoonOffIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
            Off
          </span>
        </Button>
        <Button
          type="button"
          variant={isOn ? "primary" : "ghost"}
          role="radio"
          aria-checked={isOn}
          size="compact"
          className={cn(
            "!min-h-8 shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold",
            isOn ? courierChrome.recoveryPrimary : courierStatusIdle,
          )}
          disabled={saving || availabilityLocked}
          onClick={() => saveStatus("available")}
          title={availabilityLocked ? "Finish your active delivery before changing availability." : undefined}
        >
          <span className="inline-flex items-center justify-center gap-1">
            <SunOnIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
            On
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
 * @param {{ token: string, communityId: string, onOrdersRefresh?: () => void | Promise<void>, viewerProfile?: { id: string, displayName?: string, username?: string, avatarUrl?: string } | null }} props
 */
export function CourierPresenceControls({ token, communityId, onOrdersRefresh, viewerProfile = null }) {
  const [courierStatus, setCourierStatus] = useState("offline");
  /** Kept in sync with API so PATCH doesn’t wipe tags while tags UI is hidden. */
  const [optionalTags, setOptionalTags] = useState([]);
  const [courierModes, setCourierModes] = useState([]);
  const [viewerBadges, setViewerBadges] = useState(/** @type {{ id: string, label: string }[]} */ ([]));
  const [viewerCompleted, setViewerCompleted] = useState(0);
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
  }, []);

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
      setAllowTaskNotifications(true);
      setSuggestedCompensationCents(null);
      setSuggestedPesosDraft("");
    } finally {
      setLoading(false);
    }
  }, [token, applyPresencePayload]);

  /** Re-sync Off/On + busy from server without showing the full presence skeleton (used when open-delivery poll sees a change). */
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

  useEffect(() => {
    if (!token || courierStatus === "offline") {
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
  }, [token, courierStatus]);

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
    setSavingSuggested(true);
    setNote("");
    try {
      const raw = String(suggestedPesosDraft || "").trim();
      let suggestedPayload = null;
      if (raw === "") {
        suggestedPayload = null;
      } else {
        const pesos = Number(raw);
        if (!Number.isFinite(pesos) || pesos < 0) {
          setNote("Enter a valid suggested rate in pesos, or leave blank to clear.");
          return;
        }
        suggestedPayload = Math.round(pesos * 100);
      }
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
    };
  }, [
    viewerProfile,
    courierStatus,
    normalizedOptionalTags,
    courierModes,
    viewerCompleted,
    viewerBadges,
    suggestedCompensationCents,
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
    ? "You’re on an active delivery — complete it before changing Off/On. Busy is set automatically."
    : presenceHint(courierStatus);
  const showAvailabilityHint = Boolean(availabilityHintText);

  return (
    <div className="space-y-4">
      <div>
        {!communityId ? (
          <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
            Join a community on your profile to receive neighbor deliveries.
          </p>
        ) : null}
        {!loading && neighborPreviewCourier ? (
          <div className={cn("mt-3 shadow-sm dark:shadow-none", courierChrome.courierPanelSurface)}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800/90 dark:text-violet-200/90">
              How neighbors see you
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className={cn("min-h-9 shrink-0 px-2.5 text-[10px] font-semibold", courierChrome.recoverySecondary)}
                onClick={() => setNeighborSettingsOpen(true)}
              >
                Edit
              </Button>
            </div>
            <div className="mt-3 border-t border-violet-200/60 pt-3 dark:border-violet-800/35">
              <CourierPublicProfileContent courier={neighborPreviewCourier} variant="inline" />
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
                saveStatus={saveStatus}
                courierChrome={courierChrome}
                courierStatusIdle={courierStatusIdle}
              />
            ) : null}
            {showAvailabilityHint ? (
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
            viewerSuggestedCompensationCents={suggestedCompensationCents}
            courierTransportState={courierTransportState}
            showInlineTransportPicker={false}
            headerTrailing={
              communityId ? (
                <CourierAvailabilityRadios
                  groupId={groupId}
                  hintId={hintId}
                  describeHint={showAvailabilityHint}
                  className="shrink-0"
                  isOn={isOn}
                  saving={saving}
                  availabilityLocked={availabilityLocked}
                  saveStatus={saveStatus}
                  courierChrome={courierChrome}
                  courierStatusIdle={courierStatusIdle}
                />
              ) : null
            }
            onClaimed={async () => {
              await refresh();
              if (typeof onOrdersRefresh === "function") await onOrdersRefresh();
            }}
            onDeliveriesLoaded={refreshPresenceQuiet}
          />
          <CourierEngagementBoard token={token} communityId={communityId} />
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
                  Allow notifications for new tasks / assignments.
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500 dark:text-slate-500">
                    Native apps can use this with your device push token later; we never show your token in the app.
                  </span>
                </label>
              </div>

              <div className="rounded-xl border border-neutral-200/80 bg-white/70 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/35">
                <p className="text-[10px] font-medium text-neutral-800 dark:text-slate-200">Optional neighbor badges</p>
                <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
                  Green tags on your card in Neighbor couriers. Turn off any you don’t want shown.
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

              <div className="rounded-lg border border-violet-200/50 bg-white/60 px-2.5 py-2 dark:border-violet-800/40 dark:bg-violet-950/20">
                <p className="text-[10px] font-medium text-neutral-800 dark:text-slate-200">Suggested courier pay (optional)</p>
                <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
                  For neighbors&apos; reference only — not auto-charged and not a bid.
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="flex min-w-0 flex-1 flex-col text-[10px] text-neutral-700 dark:text-slate-300">
                    ₱
                    <input
                      type="text"
                      inputMode="decimal"
                      className="mt-0.5 min-h-9 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950"
                      placeholder="e.g. 50"
                      value={suggestedPesosDraft}
                      onChange={(e) => setSuggestedPesosDraft(e.target.value)}
                      disabled={savingSuggested || courierStatus === "busy"}
                      autoComplete="off"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    className={cn("min-h-9 shrink-0", courierChrome.recoverySecondary)}
                    disabled={savingSuggested || courierStatus === "busy"}
                    loading={savingSuggested}
                    loadingLabel="…"
                    onClick={() => void saveSuggestedRate()}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {modesLoaded && selectableModes.length > 0 ? (
                <div className="rounded-lg border border-violet-200/60 bg-violet-50/50 px-2.5 py-2 dark:border-violet-800/40 dark:bg-violet-950/30">
                  <p className="text-[10px] font-medium text-neutral-700 dark:text-slate-300">Transport for this run</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Delivery transport mode">
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
                          courierStatus === "offline" ||
                          saving ||
                          savingNotify ||
                          savingTags ||
                          savingSuggested
                        }
                        onClick={() => setClaimMode(m)}
                      >
                        {MODE_LABEL[m] ?? m}
                      </Button>
                    ))}
                  </div>
                  {profileModes.length === 0 ? (
                    <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-slate-500">
                      Add modes on your profile to limit choices — until then, any mode can be recorded for this run.
                    </p>
                  ) : null}
                </div>
              ) : null}
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
