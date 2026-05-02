import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { getActivityTabChrome } from "../../lib/activityTabTheme.js";
import { ACTIVITY_TABS } from "../../views.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";

const courierChrome = getActivityTabChrome(ACTIVITY_TABS.COURIER);

function isLikelyOfflineError(e) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(e?.message || e || "");
  return /failed to fetch|network|load failed|offline/i.test(msg);
}

/**
 * Phase 5 — community courier leaderboards (counts, top of week, fastest).
 *
 * @param {{ token: string, communityId: string }} props
 */
export function CourierEngagementBoard({ token, communityId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !communityId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const d = await apiRequest(`/communities/${encodeURIComponent(communityId)}/courier-engagement`, { token });
      setData(d);
    } catch (e) {
      setData(null);
      if (isLikelyOfflineError(e)) {
        setError("You appear to be offline. Check your connection and try again.");
      } else {
        setError(e?.message || "Could not load engagement.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token || !communityId) return null;

  const rules = data?.rules ?? {};
  const period = data?.period ?? {};

  const RowMini = ({ row, rank }) => (
    <li className="flex items-center gap-2 rounded-md border border-neutral-100 bg-white/80 px-2 py-1.5 dark:border-slate-600/60 dark:bg-slate-900/50">
      <span className="w-5 shrink-0 text-center text-[10px] font-bold text-neutral-400 dark:text-slate-500">{rank}</span>
      <StableAvatar
        src={row.avatarUrl || ""}
        alt=""
        initials={(row.displayName || row.username || "?").slice(0, 2)}
        className="h-7 w-7 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-neutral-900 dark:text-slate-100">
          {row.displayName || row.username || "Courier"}
        </p>
        <p className="text-[10px] text-neutral-500 dark:text-slate-400">
          {row.deliveryCount} run{row.deliveryCount === 1 ? "" : "s"}
          {row.avgRating != null ? ` · ★ ${row.avgRating} (${row.reviewCount} rev)` : ""}
        </p>
      </div>
    </li>
  );

  return (
    <div className="mt-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/70">
      <div className="space-y-3 rounded-xl border border-violet-200/65 bg-violet-50/45 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-violet-800/45 dark:bg-violet-950/30 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-violet-950 dark:text-violet-100">Neighborhood leaderboard</h4>
          <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
            This community · Weeks start Monday (UTC) · Informal stats only.
          </p>
        </div>
        <button
          type="button"
          className={`rounded-lg border border-violet-300/70 px-2 py-1 text-[10px] font-medium text-violet-900 hover:bg-white/80 dark:border-violet-700/50 dark:text-violet-100 dark:hover:bg-violet-900/40 ${courierChrome.recoveryPrimary}`}
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">Today (UTC day)</p>
              <ol className="mt-1.5 space-y-1">
                {(data.leaderboardToday || []).length ? (
                  (data.leaderboardToday || []).map((row, i) => <RowMini key={row.courierId} row={row} rank={i + 1} />)
                ) : (
                  <li className="text-[11px] text-neutral-500 dark:text-slate-500">No completed runs in your barangay today yet.</li>
                )}
              </ol>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">This week</p>
              <ol className="mt-1.5 space-y-1">
                {(data.leaderboardWeek || []).length ? (
                  (data.leaderboardWeek || []).map((row, i) => <RowMini key={row.courierId} row={row} rank={i + 1} />)
                ) : (
                  <li className="text-[11px] text-neutral-500 dark:text-slate-500">No completed runs in your barangay this week yet.</li>
                )}
              </ol>
            </div>
          </div>

          {data.topCourierOfWeek ? (
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/30">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">Top courier (week)</p>
              <p className="mt-1 text-[11px] text-emerald-950 dark:text-emerald-100">
                {data.topCourierOfWeek.displayName || data.topCourierOfWeek.username} — {data.topCourierOfWeek.deliveryCount} run
                {data.topCourierOfWeek.deliveryCount === 1 ? "" : "s"} (min ★{rules.minAvgRatingForTop} avg, {rules.minReviewsForTop}+ review
                {rules.minReviewsForTop === 1 ? "" : "s"})
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-neutral-500 dark:text-slate-500">
              No one qualifies for “top” yet (needs enough reviews and rating ≥ {rules.minAvgRatingForTop ?? "—"}).
            </p>
          )}

          {data.fastestRunnerWeek ? (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2.5 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">Fastest runner (week)</p>
              <p className="mt-1 text-[11px] text-amber-950 dark:text-amber-100">
                {data.fastestRunnerWeek.displayName || data.fastestRunnerWeek.username} — ~{data.fastestRunnerWeek.avgMinutesAssignedToComplete}{" "}
                min avg (claim → done, n={data.fastestRunnerWeek.deliverySamplesForTiming})
              </p>
              {data.meta?.fastestRunnerPhaseNote ? (
                <p className="mt-1 text-[10px] text-amber-900/80 dark:text-amber-200/90">{data.meta.fastestRunnerPhaseNote}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-[10px] text-neutral-500 dark:text-slate-500">
              Fastest runner needs ≥ {rules.fastestMinDeliveries ?? 2} timed runs this week in your community.
            </p>
          )}

          <p className="text-[9px] leading-snug text-neutral-400 dark:text-slate-600">
            Week starts {period.weekStartsAt ? new Date(period.weekStartsAt).toLocaleString(undefined, { dateStyle: "medium" }) : "—"} UTC · Today starts{" "}
            {period.todayStartsAt ? new Date(period.todayStartsAt).toLocaleString(undefined, { dateStyle: "medium" }) : "—"} UTC
          </p>
        </>
      ) : loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-violet-200/30 dark:bg-violet-900/40" aria-hidden />
      ) : null}
      </div>
    </div>
  );
}
