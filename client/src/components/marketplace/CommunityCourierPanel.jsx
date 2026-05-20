import { useEffect, useId, useMemo, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { COURIER_OPTIONAL_TAG_LABEL, formatSuggestedCompensationPesos } from "../../lib/courierPublicProfile.js";
import { MODE_LABEL, MODE_ORDER } from "../../lib/courierTransportModes.js";
import { cn } from "../../lib/cn.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";
import { Button } from "../ui/Button.jsx";
import { CourierPublicProfileModal } from "./CourierPublicProfileModal.jsx";
import { SuggestCourierConfirmModal } from "./SuggestCourierConfirmModal.jsx";

function statusRank(s) {
  return s === "active" ? 0 : 1;
}

const COURIER_LIST_CACHE_TTL_MS = 60_000;
/** @type {Map<string, { couriers: object[], fetchedAt: number }>} */
const courierListCacheByCommunityId = new Map();

function getCachedCourierList(communityId) {
  const key = String(communityId || "").trim();
  if (!key) return null;
  const entry = courierListCacheByCommunityId.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > COURIER_LIST_CACHE_TTL_MS) {
    courierListCacheByCommunityId.delete(key);
    return null;
  }
  return entry.couriers;
}

function setCachedCourierList(communityId, couriers) {
  const key = String(communityId || "").trim();
  if (!key) return;
  courierListCacheByCommunityId.set(key, {
    couriers: Array.isArray(couriers) ? couriers : [],
    fetchedAt: Date.now(),
  });
}

function invalidateCourierListCache(communityId) {
  const key = String(communityId || "").trim();
  if (key) courierListCacheByCommunityId.delete(key);
}

/** Matches Activity order-tab rose badges — neighbor availability count. */
const NEIGHBOR_BADGE_CLASS =
  "inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-rose-600 px-[5px] py-px text-[9px] font-bold tabular-nums leading-none text-white shadow-sm dark:bg-rose-500";

/**
 * Buyer or seller: pick a neighbor courier for a delivery order (same community as listing).
 * Uses POST /orders/:id/courier/assign — backend stores the courier on `courier_assignments`.
 *
 * Pass `excludeUserIds` to omit profiles from this list (e.g. the order’s buyer and seller).
 * Pass `order`, `viewerRole`, and `onPoolUpdated` so **Suggest** opens a tip verification modal (PATCH pool then assign).
 */
export function CommunityCourierPanel({
  token,
  communityId,
  orderId,
  compact,
  onAssigned,
  heading = "Neighbor couriers",
  assignButtonLabel = "Suggest",
  suggestedButtonLabel = "Suggested",
  excludeUserIds,
  /** Current order row — enables confirm modal with tip adjustment. */
  order = null,
  /** `"buyer"` | `"seller"` — who is viewing (matches Activity commerce tab). */
  viewerRole = null,
  /** After PATCH to courier contributions, refresh lists so amounts stay in sync. */
  onPoolUpdated,
}) {
  const listRegionId = useId();
  /** Collapsed by default — list loads in background (cached per community) so header badge can show counts. */
  const [listExpanded, setListExpanded] = useState(false);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [profileCourier, setProfileCourier] = useState(null);
  /** Session-only: last courier successfully invited for this order (resets on navigation / order change). */
  const [lastSuggestedCourierId, setLastSuggestedCourierId] = useState(/** @type {string | null} */ (null));
  /** Opens tip verification before POST assign when `order` + `viewerRole` are set. */
  const [pendingSuggestCourier, setPendingSuggestCourier] = useState(/** @type {object | null} */ (null));
  /** Bumps fetch when user retries after an error. */
  const [courierFetchNonce, setCourierFetchNonce] = useState(0);

  const suggestConfirmFlow = Boolean(order && viewerRole && (viewerRole === "buyer" || viewerRole === "seller"));

  const sorted = useMemo(() => {
    const list = Array.isArray(couriers) ? [...couriers] : [];
    list.sort((a, b) => {
      const d = statusRank(a.courierStatus) - statusRank(b.courierStatus);
      if (d !== 0) return d;
      return String(a.username || "").localeCompare(String(b.username || ""), undefined, { sensitivity: "base" });
    });
    return list;
  }, [couriers]);

  const excludeIdSet = useMemo(() => {
    const ids = Array.isArray(excludeUserIds) ? excludeUserIds : [];
    return new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  }, [excludeUserIds]);

  const visibleCouriers = useMemo(
    () => sorted.filter((c) => !excludeIdSet.has(String(c.id || ""))),
    [sorted, excludeIdSet],
  );

  const neighborBadgeCount = visibleCouriers.length;
  const showRoseNeighborBadge = neighborBadgeCount > 0 && !loading && !error;
  const collapsedSubtitle = useMemo(() => {
    if (listExpanded) return null;
    if (error) return "Couldn’t load the list · tap to retry";
    if (loading) return "Checking who’s available…";
    if (neighborBadgeCount > 0) {
      return `${neighborBadgeCount} neighbor${neighborBadgeCount === 1 ? "" : "s"} available · tap to invite`;
    }
    if (sorted.length === 0) {
      return "No active couriers nearby · tap for options";
    }
    return "Buyer & seller aren’t listed here · tap for details";
  }, [listExpanded, loading, error, neighborBadgeCount, sorted.length]);

  useEffect(() => {
    if (!token || !communityId) {
      setCouriers([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    const cached = getCachedCourierList(communityId);
    if (cached) {
      setCouriers(cached);
      setLoading(false);
      setError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void apiRequest(`/communities/${encodeURIComponent(communityId)}/couriers`, { token })
      .then((d) => {
        const list = Array.isArray(d?.couriers) ? d.couriers : [];
        if (!cancelled) {
          setCachedCourierList(communityId, list);
          setCouriers(list);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCouriers([]);
          setError(e?.message || "Could not load couriers.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, communityId, courierFetchNonce]);

  useEffect(() => {
    setLastSuggestedCourierId(null);
  }, [orderId]);

  /** @returns {Promise<boolean>} */
  const doAssign = async (courierId) => {
    if (!token || !orderId || !courierId) return false;
    setAssigningId(courierId);
    setError("");
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/courier/assign`, {
        method: "POST",
        token,
        body: { courierId },
      });
      setLastSuggestedCourierId(String(courierId));
      if (typeof onAssigned === "function") await onAssigned();
      return true;
    } catch (e) {
      setError(e?.message || "Could not assign courier.");
      return false;
    } finally {
      setAssigningId(null);
    }
  };

  const startSuggestFlow = (courierRow) => {
    if (suggestConfirmFlow) setPendingSuggestCourier(courierRow);
    else void doAssign(String(courierRow.id || ""));
  };

  if (!communityId) {
    return (
      <div
        className={`rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100 ${
          compact ? "" : "md:text-xs"
        }`}
      >
        Link this listing to a community shop so neighbors can deliver with trust-based matching (no in-app map routing).
      </div>
    );
  }

  const headerAriaLabel = [
    heading,
    showRoseNeighborBadge ? `${neighborBadgeCount} neighbors available` : null,
    error ? "Could not load couriers" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`space-y-2 ${compact ? "" : "md:space-y-2.5"}`}>
      <div
        className={cn(
          "rounded-xl border border-violet-200/75 bg-gradient-to-br from-violet-50/90 via-white to-white shadow-sm ring-1 ring-violet-500/[0.06] dark:border-violet-800/45 dark:from-violet-950/40 dark:via-slate-900/50 dark:to-slate-900/30 dark:ring-violet-400/[0.08]",
          compact ? "p-1.5" : "p-2",
        )}
      >
        <button
          type="button"
          className={cn(
            "flex w-full items-start gap-2 rounded-lg text-left outline-none transition hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-violet-500/45 dark:hover:bg-slate-800/40 dark:focus-visible:ring-violet-500/35",
            compact ? "-m-0.5 p-0.5" : "-m-1 p-1",
          )}
          aria-expanded={listExpanded}
          aria-controls={listRegionId}
          aria-label={headerAriaLabel}
          onClick={() => setListExpanded((open) => !open)}
        >
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100/90 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200"
            aria-hidden
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "font-semibold tracking-tight text-neutral-900 dark:text-slate-100",
                  compact ? "text-[11px]" : "text-sm",
                )}
              >
                {heading}
              </span>
              {showRoseNeighborBadge ? (
                <span className={NEIGHBOR_BADGE_CLASS} title="Neighbors you can suggest for this delivery">
                  {neighborBadgeCount > 99 ? "99+" : neighborBadgeCount}
                </span>
              ) : null}
              {error ? (
                <span
                  className="inline-flex items-center rounded-full bg-red-100 px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950/80 dark:text-red-200"
                  title={error}
                >
                  Error
                </span>
              ) : null}
            </span>
            {collapsedSubtitle ? (
              <span
                className={cn(
                  "mt-0.5 block text-neutral-600 dark:text-slate-400",
                  compact ? "text-[9px] leading-snug" : "text-[10px] leading-snug",
                )}
              >
                {collapsedSubtitle}
              </span>
            ) : null}
          </span>
          <svg
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 dark:text-slate-400",
              listExpanded ? "rotate-180" : "rotate-0",
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <div id={listRegionId} hidden={!listExpanded} className="space-y-2">
      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            className="text-[11px] font-semibold text-violet-700 underline decoration-violet-400/80 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
            onClick={() => {
              invalidateCourierListCache(communityId);
              setError("");
              setCourierFetchNonce((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <p className={`text-neutral-500 dark:text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>Loading couriers…</p>
      ) : visibleCouriers.length === 0 ? (
        sorted.length === 0 ? (
          <div
            className={cn(
              "rounded-xl border border-neutral-200/85 bg-neutral-50/90 px-3 py-3 dark:border-slate-600/70 dark:bg-slate-800/50",
              compact ? "py-2.5" : "",
            )}
          >
            <div className="flex gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-600 dark:bg-slate-700 dark:text-slate-300"
                aria-hidden
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <div className="min-w-0 space-y-1.5">
                <p
                  className={cn(
                    "font-semibold text-neutral-900 dark:text-slate-100",
                    compact ? "text-[11px]" : "text-xs",
                  )}
                >
                  No couriers available right now
                </p>
                <p className={`text-neutral-600 dark:text-slate-400 ${compact ? "text-[10px] leading-relaxed" : "text-[11px] leading-relaxed"}`}>
                  Nobody in this community is marked Available or Active at the moment. Check back soon, message your seller if
                  you need help, or use{" "}
                  <span className="font-medium text-neutral-800 dark:text-slate-200">I&apos;ll deliver myself</span> / COD as
                  usual.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-3 dark:border-violet-800/50 dark:bg-violet-950/35",
              compact ? "py-2.5" : "",
            )}
          >
            <div className="flex gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-200/80 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200"
                aria-hidden
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div className="min-w-0 space-y-1.5">
                <p
                  className={cn(
                    "font-semibold text-neutral-900 dark:text-slate-100",
                    compact ? "text-[11px]" : "text-xs",
                  )}
                >
                  No extra neighbors on this list
                </p>
                <p className={`text-neutral-700 dark:text-slate-300 ${compact ? "text-[10px] leading-relaxed" : "text-[11px] leading-relaxed"}`}>
                  Other neighbors may still be couriers for your community — this card never shows the{" "}
                  <span className="font-medium">buyer</span> or <span className="font-medium">seller</span> on the order. If
                  everyone else is busy, try again later or arrange delivery directly with the seller.
                </p>
              </div>
            </div>
          </div>
        )
      ) : (
        <ul
          className={cn(
            "grid overflow-y-auto overscroll-contain pr-0.5",
            /** Dense Activity cards: single column so panels stay readable inside tight columns. */
            compact ? "grid-cols-1 gap-2 max-h-[min(72vh,28rem)]" : "max-h-[min(85vh,40rem)]",
            !compact &&
              [
                "gap-2 min-[360px]:gap-2.5 md:gap-3",
                /* <360: one column */
                "grid-cols-1",
                /*
                 * auto-fit collapses empty tracks so one courier fills the row (fixed 2-col grids left a blank column).
                 * 360–767 + md/lg: as many columns as fit; single card spans full width.
                 */
                "min-[360px]:[grid-template-columns:repeat(auto-fit,minmax(min(100%,10.25rem),1fr))]",
                "md:[grid-template-columns:repeat(auto-fit,minmax(min(100%,11.25rem),1fr))]",
                "lg:[grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]",
              ].join(" "),
          )}
        >
          {visibleCouriers.map((c) => {
            const modeKeys = Array.isArray(c.modes)
              ? [
                  ...new Set(
                    c.modes
                      .map((x) => String(x || "").trim().toLowerCase())
                      .filter((x) => MODE_ORDER.includes(x)),
                  ),
                ]
              : [];
            const modeKeysOrdered = MODE_ORDER.filter((m) => modeKeys.includes(m));
            const cid = String(c.id || "");
            const isSuggested = Boolean(lastSuggestedCourierId && cid === lastSuggestedCourierId);
            const suggestedPay = formatSuggestedCompensationPesos(c.suggestedCompensationCents);
            const pillBase =
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ring-1";
            return (
            <li
              key={String(c.id)}
              className={cn(
                "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border shadow-sm dark:border-slate-600/80 dark:bg-slate-900/50 dark:shadow-none",
                compact
                  ? "rounded-lg border-neutral-200/85 bg-white px-2 pt-2"
                  : "rounded-xl border-neutral-200/90 bg-white px-3 pt-2.5",
              )}
            >
              <div className={cn("flex min-h-0 min-w-0 flex-col", compact ? "gap-1.5 pb-2" : "gap-2 pb-2")}>
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left outline-none ring-brand-primary/0 transition hover:bg-neutral-50/90 focus-visible:ring-2 dark:hover:bg-slate-800/60 dark:focus-visible:ring-brand-accent/40 md:gap-3",
                    compact ? "-m-0.5 p-0.5" : "-m-1 p-1",
                  )}
                  onClick={() => setProfileCourier(c)}
                >
                  <StableAvatar
                    src={c.avatarUrl || ""}
                    alt=""
                    initials={(String(c.displayName || c.username || "?").trim().charAt(0) || "?").toUpperCase()}
                    className={cn("shrink-0 text-xs", compact ? "h-9 w-9" : "h-10 w-10")}
                    sizes={compact ? "36px" : "40px"}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p
                      className={cn(
                        "line-clamp-2 break-words font-semibold leading-snug text-neutral-900 dark:text-slate-100",
                        compact ? "text-xs" : "text-sm",
                      )}
                    >
                      {c.displayName || c.username || "Member"}
                    </p>
                    <p className="text-[10px] leading-snug text-neutral-500 dark:text-slate-500">
                      {c.courierStatus === "active" ? "Active — on the move" : "Available"}
                      {typeof c.completedDeliveries === "number" && c.completedDeliveries > 0
                        ? ` · ${c.completedDeliveries} completed`
                        : ""}
                    </p>
                    {typeof c.courierAvgRating === "number" &&
                    Number.isFinite(c.courierAvgRating) &&
                    typeof c.courierReviewCount === "number" &&
                    c.courierReviewCount > 0 ? (
                      <p
                        className="text-[10px] font-medium leading-snug text-amber-800/95 tabular-nums dark:text-amber-200/95"
                        role="status"
                        aria-label={`Average ${c.courierAvgRating.toFixed(1)} out of 5 from ${c.courierReviewCount} buyer ratings`}
                      >
                        <span className="text-amber-500 dark:text-amber-400" aria-hidden>
                          ★
                        </span>{" "}
                        {c.courierAvgRating.toFixed(1)}{" "}
                        <span className="font-normal text-neutral-500 dark:text-slate-500">
                          ({c.courierReviewCount} {c.courierReviewCount === 1 ? "rating" : "ratings"})
                        </span>
                      </p>
                    ) : null}
                    {suggestedPay ? (
                      <p className="text-[10px] leading-snug text-neutral-600 dark:text-slate-400">
                        <span className="font-medium text-neutral-700 dark:text-slate-300">Suggested neighbor rate</span>{" "}
                        <span className="tabular-nums font-semibold text-neutral-900 dark:text-slate-100">{suggestedPay}</span>
                        <span className="font-normal text-neutral-500 dark:text-slate-500"> · reference only</span>
                      </p>
                    ) : null}
                  </div>
                </button>
                <div className="flex w-full min-w-0 shrink-0 flex-col justify-start">
                  {isSuggested ? (
                    <span
                      role="status"
                      className={cn(
                        "inline-flex min-h-9 w-full items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                        "border-emerald-500/85 bg-emerald-50 text-emerald-900 dark:border-emerald-600/80 dark:bg-emerald-950/50 dark:text-emerald-100",
                      )}
                    >
                      {suggestedButtonLabel}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 w-full px-3 py-1.5 text-[11px] font-semibold shadow-none ring-1 ring-neutral-200/90 hover:bg-neutral-50 dark:ring-slate-600/70 dark:hover:bg-slate-800/80"
                      loading={assigningId === c.id}
                      loadingLabel="…"
                      disabled={Boolean(assigningId)}
                      onClick={() => startSuggestFlow(c)}
                    >
                      {assignButtonLabel}
                    </Button>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 border-t border-neutral-200/75 bg-neutral-50/70 py-2 dark:border-slate-600/55 dark:bg-slate-800/40",
                  compact ? "-mx-2 mt-0 px-2 pb-2" : "-mx-3 mt-0 px-3 pb-2.5",
                )}
                aria-label="Transport modes and profile tags"
              >
                {modeKeysOrdered.map((m) => (
                  <span
                    key={m}
                    className={`${pillBase} bg-violet-50 text-violet-900 ring-violet-200/80 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-700/50`}
                  >
                    {MODE_LABEL[m] ?? m}
                  </span>
                ))}
                {modeKeysOrdered.length === 0 ? (
                  <span
                    className={`${pillBase} bg-white/90 font-normal text-neutral-500 ring-neutral-200/80 dark:bg-slate-900/50 dark:text-slate-400 dark:ring-slate-600/60`}
                    title="This courier has not saved Walk, Run, Bike, or Others on their profile yet (Activity → Courier → Edit)."
                  >
                    Modes not set
                  </span>
                ) : null}
                {Array.isArray(c.optionalTags) && c.optionalTags.length
                  ? c.optionalTags.map((t) => (
                      <span
                        key={t}
                        className={`${pillBase} bg-emerald-50 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-800/45`}
                      >
                        {COURIER_OPTIONAL_TAG_LABEL[t] || t}
                      </span>
                    ))
                  : null}
                {Array.isArray(c.badges) && c.badges.length
                  ? c.badges.map((b) => (
                      <span
                        key={b.id}
                        className={`${pillBase} bg-amber-50 font-semibold text-amber-950 ring-amber-200/80 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-700/50`}
                        title="Earned from completed deliveries"
                      >
                        {b.label}
                      </span>
                    ))
                  : null}
              </div>
            </li>
            );
          })}
        </ul>
      )}
      </div>
      <CourierPublicProfileModal
        open={Boolean(profileCourier)}
        courier={profileCourier}
        onClose={() => setProfileCourier(null)}
        footer={
          profileCourier && orderId ? (
            String(profileCourier.id || "") === lastSuggestedCourierId ? (
              <span
                role="status"
                className="flex w-full min-h-11 items-center justify-center rounded-xl border border-emerald-500/85 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:border-emerald-600/80 dark:bg-emerald-950/50 dark:text-emerald-100"
              >
                {suggestedButtonLabel}
              </span>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="w-full"
                loading={assigningId === profileCourier.id}
                loadingLabel="…"
                disabled={Boolean(assigningId)}
                onClick={() => {
                  const c = profileCourier;
                  setProfileCourier(null);
                  startSuggestFlow(c);
                }}
              >
                {assignButtonLabel}
              </Button>
            )
          ) : null
        }
      />

      <SuggestCourierConfirmModal
        open={Boolean(pendingSuggestCourier)}
        courier={pendingSuggestCourier}
        order={order}
        viewerRole={viewerRole === "buyer" || viewerRole === "seller" ? viewerRole : "buyer"}
        token={token}
        orderId={String(orderId || "")}
        onClose={() => setPendingSuggestCourier(null)}
        onPoolUpdated={onPoolUpdated}
        onSuggest={async () => {
          const id = String(pendingSuggestCourier?.id || "");
          const ok = await doAssign(id);
          if (ok) setPendingSuggestCourier(null);
        }}
      />
    </div>
  );
}
