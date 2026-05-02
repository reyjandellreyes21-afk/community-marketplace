import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { ACTIVITY_TABS } from "../../views.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";
import { CourierEngagementBoard } from "./CourierEngagementBoard.jsx";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

const courierStatusIdle =
  "rounded-xl border-0 bg-white/90 py-3 text-sm font-semibold text-violet-900 shadow-sm ring-1 ring-violet-200/60 transition hover:bg-white dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-700/50 dark:hover:bg-violet-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45";

const SAVE_FEEDBACK = {
  offline: "You’re off.",
  available: "You’re on — check open tasks below.",
  active: "Still on — tasks below.",
  busy: "You’re on a delivery — finish up when you can.",
};

function presenceHint(status) {
  if (status === "offline") return "Off — no delivery tasks.";
  if (status === "busy") return "On a run — finish it, then turn off when you’re free.";
  if (status === "active") return "On — neighbors can match you; tasks below.";
  return "On — tasks appear below when your barangay has open deliveries.";
}

function PresenceLoadingSkeleton() {
  return (
    <div className="mt-4 h-14 animate-pulse rounded-xl bg-violet-200/40 dark:bg-violet-900/40" aria-hidden />
  );
}

/**
 * Minimal Find-deliveries controls: off/on availability + open tasks list.
 *
 * @param {{ token: string, communityId: string, onOrdersRefresh?: () => void | Promise<void> }} props
 */
export function CourierPresenceControls({ token, communityId, onOrdersRefresh }) {
  const [courierStatus, setCourierStatus] = useState("offline");
  /** Kept in sync with API so PATCH doesn’t wipe tags while tags UI is hidden. */
  const [optionalTags, setOptionalTags] = useState([]);
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
  const feedbackClearRef = useRef(/** @type {number | null} */ (null));
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const feedbackId = `${groupId}-feedback`;

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await apiRequest("/me/courier-presence", { token });
      setCourierStatus(String(d.courierStatus || "offline"));
      setOptionalTags(Array.isArray(d.optionalTags) ? d.optionalTags : []);
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
      setNote("");
    } catch {
      setCourierStatus("offline");
      setOptionalTags([]);
      setAllowTaskNotifications(true);
      setSuggestedCompensationCents(null);
      setSuggestedPesosDraft("");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (feedbackClearRef.current != null) window.clearTimeout(feedbackClearRef.current);
    };
  }, []);

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
      const sc = d.suggestedCompensationCents;
      if (sc != null && Number.isFinite(Number(sc))) {
        const n = Math.max(0, Math.floor(Number(sc)));
        setSuggestedCompensationCents(n);
        setSuggestedPesosDraft(String(n / 100));
      } else {
        setSuggestedCompensationCents(null);
        setSuggestedPesosDraft("");
      }
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
      setAllowTaskNotifications(d.allowCourierTaskNotifications !== false);
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
      const resolved = String(d.courierStatus || next);
      setCourierStatus(resolved);
      if (d.note) setNote(String(d.note));
      showSaveFeedback(resolved);
    } catch (e) {
      setNote(e?.message || "Could not update.");
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;

  const isOn = courierStatus !== "offline";
  const availabilityLocked = courierStatus === "busy";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">Community courier</h3>
        <p className="mt-1 text-[11px] text-neutral-600 dark:text-slate-400">
          COD only — no wallet. Turn on to see delivery tasks in your community.
        </p>
        {!communityId ? (
          <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
            Join a community on your profile to receive neighbor deliveries.
          </p>
        ) : null}
        {loading ? (
          <PresenceLoadingSkeleton />
        ) : (
          <>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-neutral-200/80 bg-white/80 px-3 py-2.5 dark:border-slate-600/50 dark:bg-slate-900/40">
              <input
                id={`${groupId}-notify-tasks`}
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
                checked={allowTaskNotifications}
                disabled={savingNotify}
                onChange={(e) => void saveTaskNotifications(e.target.checked)}
              />
              <label htmlFor={`${groupId}-notify-tasks`} className="cursor-pointer text-[11px] leading-snug text-neutral-800 dark:text-slate-200">
                Allow notifications for new tasks / assignments.
                <span className="mt-0.5 block text-[10px] font-normal text-neutral-500 dark:text-slate-500">
                  Native apps can use this with your device push token later; we never show your token in the app.
                </span>
              </label>
            </div>
            <div
              className="mt-4 rounded-2xl border border-violet-200/70 bg-gradient-to-b from-violet-50/90 to-violet-100/40 p-2 dark:border-violet-800/55 dark:from-violet-950/50 dark:to-violet-950/70"
              role="radiogroup"
              aria-labelledby={`${groupId}-legend`}
              aria-describedby={hintId}
            >
              <p id={`${groupId}-legend`} className="sr-only">
                Courier availability
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={!isOn ? "primary" : "ghost"}
                  role="radio"
                  aria-checked={!isOn}
                  className={cn(
                    "min-h-12 rounded-xl text-sm",
                    !isOn ? cn(courierChrome.recoveryPrimary) : courierStatusIdle,
                  )}
                  disabled={saving || availabilityLocked}
                  onClick={() => saveStatus("offline")}
                  title={availabilityLocked ? "Finish your active delivery before going offline." : undefined}
                >
                  Off
                </Button>
                <Button
                  type="button"
                  variant={isOn ? "primary" : "ghost"}
                  role="radio"
                  aria-checked={isOn}
                  className={cn(
                    "min-h-12 rounded-xl text-sm",
                    isOn ? cn(courierChrome.recoveryPrimary) : courierStatusIdle,
                  )}
                  disabled={saving || availabilityLocked}
                  onClick={() => saveStatus("available")}
                  title={availabilityLocked ? "Finish your active delivery before changing availability." : undefined}
                >
                  On
                </Button>
              </div>
            </div>
            <p id={hintId} className="mt-2 text-center text-[11px] text-neutral-600 dark:text-slate-400" aria-live="polite">
              {availabilityLocked
                ? "You’re on an active delivery — complete it before changing Off/On. Busy is set automatically."
                : presenceHint(courierStatus)}
            </p>
            {saveFeedback ? (
              <p id={feedbackId} className="mt-1 text-center text-[11px] font-medium text-emerald-800 dark:text-emerald-200" aria-live="polite">
                {saveFeedback}
              </p>
            ) : null}
            <div className="mt-3 rounded-lg border border-violet-200/50 bg-white/60 px-2.5 py-2 dark:border-violet-800/40 dark:bg-violet-950/20">
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
                  className="min-h-9 shrink-0"
                  disabled={savingSuggested || courierStatus === "busy"}
                  loading={savingSuggested}
                  loadingLabel="…"
                  onClick={() => void saveSuggestedRate()}
                >
                  Save
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {!loading ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white/70 p-3 dark:border-slate-600/60 dark:bg-slate-900/45 md:p-4">
          {note ? <p className="mb-3 text-[11px] text-neutral-600 dark:text-slate-400">{note}</p> : null}
          <CourierOpenDeliveries
            token={token}
            communityId={communityId}
            courierStatus={courierStatus}
            viewerSuggestedCompensationCents={suggestedCompensationCents}
            onClaimed={async () => {
              await refresh();
              if (typeof onOrdersRefresh === "function") await onOrdersRefresh();
            }}
          />
          <CourierEngagementBoard token={token} communityId={communityId} />
        </div>
      ) : null}
    </div>
  );
}
