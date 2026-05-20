import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";
import { cn } from "../../lib/cn.js";

function isLikelyOfflineError(e) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(e?.message || e || "");
  return /failed to fetch|network|load failed|offline/i.test(msg);
}

/** One row in the summary grid: label column + value column (stacks on narrow screens). */
function StatRow({ label, children, valueClassName }) {
  return (
    <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(7.5rem,34%)_minmax(0,1fr)] sm:items-start sm:gap-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-950/95 dark:text-violet-100/95">{label}</div>
      <div className={cn("min-w-0 text-[11px] leading-snug text-neutral-700 dark:text-slate-300", valueClassName)}>{children}</div>
    </div>
  );
}

/**
 * Phase 5 — community courier leaderboards (counts, top of week, fastest).
 *
 * @param {{ token: string, communityId: string, leadDivider?: boolean }} props
 */
export function CourierEngagementBoard({ token, communityId, leadDivider = true }) {
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
    <li className="flex items-center gap-2 rounded-md border border-neutral-100 bg-white/90 px-2 py-1.5 dark:border-slate-600/60 dark:bg-slate-900/55">
      <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-neutral-400 dark:text-slate-500">
        {rank}
      </span>
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
    <div className={leadDivider ? "mt-4 border-t border-neutral-200/80 pt-4 dark:border-slate-700/70" : ""}>
      <div className="space-y-3 rounded-xl border border-violet-200/65 bg-violet-50/45 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-violet-800/45 dark:bg-violet-950/30 md:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-violet-950 dark:text-violet-100">Neighborhood leaderboard</h4>
            <p className="mt-0.5 max-w-prose text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
              This community · Weeks start Monday (UTC) · Informal stats only.
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && data ? (
          <>
            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white/75 dark:border-slate-600/70 dark:bg-slate-900/45">
              <div className="grid divide-y divide-neutral-200/75 dark:divide-slate-600/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <section className="p-2.5 sm:p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">
                    Today (UTC day)
                  </p>
                  <p className="mt-0.5 text-[9px] text-neutral-500 dark:text-slate-500">By completed runs in your barangay.</p>
                  <ol className="mt-2 space-y-1.5">
                    {(data.leaderboardToday || []).length ? (
                      (data.leaderboardToday || []).map((row, i) => (
                        <RowMini key={row.courierId} row={row} rank={i + 1} />
                      ))
                    ) : (
                      <li className="rounded-md border border-dashed border-neutral-200/90 bg-neutral-50/80 px-2.5 py-2 text-[11px] text-neutral-600 dark:border-slate-600/70 dark:bg-slate-800/40 dark:text-slate-400">
                        No completed runs today yet.
                      </li>
                    )}
                  </ol>
                </section>
                <section className="p-2.5 sm:p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">
                    This week
                  </p>
                  <p className="mt-0.5 text-[9px] text-neutral-500 dark:text-slate-500">Same week window as stats below.</p>
                  <ol className="mt-2 space-y-1.5">
                    {(data.leaderboardWeek || []).length ? (
                      (data.leaderboardWeek || []).map((row, i) => (
                        <RowMini key={row.courierId} row={row} rank={i + 1} />
                      ))
                    ) : (
                      <li className="rounded-md border border-dashed border-neutral-200/90 bg-neutral-50/80 px-2.5 py-2 text-[11px] text-neutral-600 dark:border-slate-600/70 dark:bg-slate-800/40 dark:text-slate-400">
                        No completed runs this week yet.
                      </li>
                    )}
                  </ol>
                </section>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white/80 dark:border-slate-600/70 dark:bg-slate-900/50">
              <p className="border-b border-neutral-200/75 bg-neutral-50/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-300">
                Week highlights &amp; rules
              </p>
              <div className="divide-y divide-neutral-200/75 dark:divide-slate-600/60">
                <StatRow label="Top courier (week)">
                  {data.topCourierOfWeek ? (
                    <div className="rounded-md border border-emerald-200/90 bg-emerald-50/70 px-2.5 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/35">
                      <p className="font-medium text-emerald-950 dark:text-emerald-100">
                        {data.topCourierOfWeek.displayName || data.topCourierOfWeek.username}
                      </p>
                      <p className="mt-0.5 text-[10px] text-emerald-900/95 dark:text-emerald-200/90">
                        {data.topCourierOfWeek.deliveryCount} run{data.topCourierOfWeek.deliveryCount === 1 ? "" : "s"} · min ★
                        {rules.minAvgRatingForTop} avg, {rules.minReviewsForTop}+ review
                        {rules.minReviewsForTop === 1 ? "" : "s"}
                      </p>
                    </div>
                  ) : (
                    <span className="text-neutral-600 dark:text-slate-400">
                      No one qualifies yet — needs enough reviews and rating ≥ {rules.minAvgRatingForTop ?? "—"}.
                    </span>
                  )}
                </StatRow>
                <StatRow label="Fastest runner (week)">
                  {data.fastestRunnerWeek ? (
                    <div className="rounded-md border border-amber-200/90 bg-amber-50/70 px-2.5 py-2 dark:border-amber-800/50 dark:bg-amber-950/35">
                      <p className="font-medium text-amber-950 dark:text-amber-100">
                        {data.fastestRunnerWeek.displayName || data.fastestRunnerWeek.username}
                      </p>
                      <p className="mt-0.5 text-[10px] text-amber-950/95 dark:text-amber-200/90">
                        ~{data.fastestRunnerWeek.avgMinutesAssignedToComplete} min avg (claim → done, n=
                        {data.fastestRunnerWeek.deliverySamplesForTiming})
                      </p>
                      {data.meta?.fastestRunnerPhaseNote ? (
                        <p className="mt-1.5 text-[10px] leading-snug text-amber-900/85 dark:text-amber-200/85">
                          {data.meta.fastestRunnerPhaseNote}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-neutral-600 dark:text-slate-400">
                      Needs ≥ {rules.fastestMinDeliveries ?? 2} timed runs this week in your community.
                    </span>
                  )}
                </StatRow>
                <StatRow label="Period (UTC)">
                  <div className="space-y-1 text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                    <p>
                      <span className="font-medium text-neutral-700 dark:text-slate-300">Week starts:</span>{" "}
                      {period.weekStartsAt
                        ? new Date(period.weekStartsAt).toLocaleString(undefined, { dateStyle: "medium" })
                        : "—"}{" "}
                      UTC
                    </p>
                    <p>
                      <span className="font-medium text-neutral-700 dark:text-slate-300">Today starts:</span>{" "}
                      {period.todayStartsAt
                        ? new Date(period.todayStartsAt).toLocaleString(undefined, { dateStyle: "medium" })
                        : "—"}{" "}
                      UTC
                    </p>
                  </div>
                </StatRow>
              </div>
            </div>
          </>
        ) : loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-violet-200/30 dark:bg-violet-900/40" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
