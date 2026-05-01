import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { Button } from "../ui/Button.jsx";
import { CourierOpenDeliveries } from "./CourierOpenDeliveries.jsx";

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
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 dark:border-slate-600/80 dark:bg-slate-900/50">
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
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={courierStatus === s.id ? "primary" : "secondary"}
                className="min-h-10 flex-col gap-0.5 py-2 text-[11px] leading-tight"
                disabled={saving}
                onClick={() => saveStatus(s.id)}
                title={s.hint}
              >
                <span>{s.label}</span>
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-500 dark:text-slate-500">
            {STATUSES.find((x) => x.id === courierStatus)?.hint || ""}
          </p>
          <p className="mt-3 text-[11px] font-medium text-neutral-700 dark:text-slate-300">Optional modes</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {OPTIONAL_TAGS.map((t) => {
              const on = optionalTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleTag(t.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    on
                      ? "border-emerald-500/80 bg-emerald-100/90 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-900/35 dark:text-emerald-100"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span aria-hidden>{t.emoji}</span> {t.label}
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
        </>
      )}
    </div>
  );
}
