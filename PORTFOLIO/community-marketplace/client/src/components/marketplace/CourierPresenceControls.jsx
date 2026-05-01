import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { cn } from "../../lib/cn.js";
import { ACTIVITY_TABS } from "../../views.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

/** Status grid: selected uses theme primary; idle = calm cells on a shared “rail” (clearer than four matching outlines). */
const courierStatusIdle =
  "rounded-lg border-0 bg-white/85 py-2.5 text-[11px] font-semibold leading-tight text-violet-900 shadow-none ring-0 transition hover:bg-white dark:bg-violet-950/45 dark:text-violet-100 dark:hover:bg-violet-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-100 dark:focus-visible:ring-offset-violet-950";

/** Optional tags: compact chips — off = paper outline; on = solid accent (distinct from status rail). */
const courierChipOff =
  "min-h-9 rounded-full border border-violet-200/90 bg-white/95 px-3 py-1.5 text-left text-[11px] font-semibold text-violet-900 shadow-sm transition hover:border-violet-400/70 hover:bg-white dark:border-violet-700/65 dark:bg-violet-950/55 dark:text-violet-100 dark:hover:border-violet-500 dark:hover:bg-violet-900/60";
const courierChipOn =
  "min-h-9 rounded-full border border-transparent bg-violet-600 px-3 py-1.5 text-left text-[11px] font-semibold text-white shadow-sm ring-1 ring-violet-700/25 transition hover:bg-violet-700 dark:bg-violet-500 dark:ring-violet-400/25";

const STATUSES = [
  { id: "offline", label: "Offline", hint: "Hidden from matching" },
  { id: "available", label: "Available", hint: "Ready for deliveries" },
  { id: "active", label: "Active", hint: "Moving — prioritized for sellers" },
  { id: "busy", label: "Busy", hint: "On a delivery (set by app when you accept)" },
];

const OPTIONAL_TAGS = [
  { id: "eco", label: "Eco", emoji: "🌱" },
  { id: "bike", label: "Bike", emoji: "🚴" },
  { id: "fast", label: "Fast", emoji: "⚡" },
  { id: "helping", label: "Helping", emoji: "🧡" },
];

/**
 * Profile: courier visibility + optional modes. Walk/run/bike modes stay on existing courier-modes control if present.
 */
export function CourierPresenceControls({ token, communityId, onOrdersRefresh }) {
  const [courierStatus, setCourierStatus] = useState("offline");
  const [optionalTags, setOptionalTags] = useState([]);
  /** @type {{ id: string, label: string }[]} */
  const [achievementBadges, setAchievementBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

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
      setAchievementBadges(Array.isArray(d.badges) ? d.badges : []);
      setNote("");
    } catch {
      setCourierStatus("offline");
      setOptionalTags([]);
      setAchievementBadges([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      setCourierStatus(String(d.courierStatus || next));
      if (Array.isArray(d.badges)) setAchievementBadges(d.badges);
      if (d.note) setNote(String(d.note));
    } catch (e) {
      setNote(e?.message || "Could not update.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = async (tagId) => {
    if (!token) return;
    const next = optionalTags.includes(tagId) ? optionalTags.filter((t) => t !== tagId) : [...optionalTags, tagId];
    setOptionalTags(next);
    setSaving(true);
    setNote("");
    try {
      const d = await apiRequest("/me/courier-presence", {
        method: "PATCH",
        token,
        body: { courierStatus, optionalTags: next },
      });
      setCourierStatus(String(d.courierStatus || courierStatus));
      if (Array.isArray(d.badges)) setAchievementBadges(d.badges);
      if (d.note) setNote(String(d.note));
    } catch (e) {
      setNote(e?.message || "Could not update.");
      setOptionalTags(optionalTags);
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">Community courier</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600 dark:text-slate-400">
          Earn by walking, running, or biking for neighbors in your community. No in-app wallet — coordinate meetups in chat.
        </p>
        {!communityId ? (
          <p className="mt-3 text-[11px] text-amber-800 dark:text-amber-200">
            Join a community on your profile so you can receive delivery requests from neighbors.
          </p>
        ) : null}
        {loading ? (
          <p className="mt-3 text-xs text-neutral-500">Loading…</p>
        ) : (
          <>
            <div
              className="mt-3 rounded-2xl border border-violet-200/70 bg-gradient-to-b from-violet-50/95 to-violet-100/50 p-1 shadow-[inset_0_1px_2px_rgba(76,29,149,0.06)] dark:border-violet-800/55 dark:from-violet-950/55 dark:to-violet-950/75 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
              role="group"
              aria-label="Courier availability"
            >
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                {STATUSES.map((s) => {
                  const selected = courierStatus === s.id;
                  return (
                    <Button
                      key={s.id}
                      type="button"
                      variant={selected ? "primary" : "ghost"}
                      className={cn(
                        "min-h-10 flex-col justify-center gap-0",
                        selected ? cn("rounded-lg shadow-sm", courierChrome.recoveryPrimary) : courierStatusIdle,
                      )}
                      disabled={saving}
                      onClick={() => saveStatus(s.id)}
                      title={s.hint}
                    >
                      <span>{s.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2.5 text-center text-[10px] text-neutral-600 dark:text-slate-400">
              {STATUSES.find((x) => x.id === courierStatus)?.hint || ""}
            </p>
          </>
        )}
      </div>

      {!loading ? (
        <div
          className={cn(
            courierChrome.courierPanelSurface,
            "shadow-sm shadow-violet-900/[0.04] dark:shadow-black/30",
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-violet-950 dark:text-violet-100">Optional modes</p>
            <p className="text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
              Optional tags on your runs — tap to turn on or off.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {OPTIONAL_TAGS.map((t) => {
              const on = optionalTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  title={`${on ? "Remove" : "Add"} ${t.label}`}
                  aria-pressed={on}
                  onClick={() => toggleTag(t.id)}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 transition motion-reduce:transition-none",
                    on ? courierChipOn : courierChipOff,
                    saving && "pointer-events-none opacity-60",
                  )}
                >
                  <span className="shrink-0 leading-none" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
          {achievementBadges.length ? (
            <div className="mt-3">
              <p className="text-[11px] font-medium text-neutral-700 dark:text-slate-300">Trust badges</p>
              <p className="mt-1 text-[10px] text-neutral-500 dark:text-slate-500">
                Earned from completed deliveries — neighbors see these when you offer runs.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {achievementBadges.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-semibold text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/50"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {note ? (
            <p className="mt-2 text-[11px] text-neutral-600 dark:text-slate-400">{note}</p>
          ) : null}
          <CourierOpenDeliveries
            token={token}
            communityId={communityId}
            courierStatus={courierStatus}
            onClaimed={async () => {
              await refresh();
              if (typeof onOrdersRefresh === "function") await onOrdersRefresh();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
