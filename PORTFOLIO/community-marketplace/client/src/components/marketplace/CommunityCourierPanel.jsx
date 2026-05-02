import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";
import { COURIER_OPTIONAL_TAG_LABEL, formatCourierModesForDisplay } from "../../lib/courierPublicProfile.js";
import { StableAvatar } from "../media/StableMediaImage.jsx";
import { Button } from "../ui/Button.jsx";
import { CourierPublicProfileModal } from "./CourierPublicProfileModal.jsx";

function statusRank(s) {
  return s === "active" ? 0 : 1;
}

/**
 * Buyer or seller: pick a community courier for a delivery order (same community as listing).
 * Uses POST /orders/:id/courier/assign — backend stores the courier on `courier_assignments`.
 */
export function CommunityCourierPanel({
  token,
  communityId,
  orderId,
  compact,
  onAssigned,
  heading = "Community couriers",
  assignButtonLabel = "Assign",
}) {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState(null);
  const [profileCourier, setProfileCourier] = useState(null);

  const sorted = useMemo(() => {
    const list = Array.isArray(couriers) ? [...couriers] : [];
    list.sort((a, b) => {
      const d = statusRank(a.courierStatus) - statusRank(b.courierStatus);
      if (d !== 0) return d;
      return String(a.username || "").localeCompare(String(b.username || ""), undefined, { sensitivity: "base" });
    });
    return list;
  }, [couriers]);

  useEffect(() => {
    if (!token || !communityId) {
      setCouriers([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void apiRequest(`/communities/${encodeURIComponent(communityId)}/couriers`, { token })
      .then((d) => {
        if (!cancelled) setCouriers(Array.isArray(d?.couriers) ? d.couriers : []);
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
  }, [token, communityId]);

  /** @returns {Promise<boolean>} */
  const assign = async (courierId) => {
    if (!token || !orderId || !courierId) return false;
    setAssigningId(courierId);
    setError("");
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/courier/assign`, {
        method: "POST",
        token,
        body: { courierId },
      });
      if (typeof onAssigned === "function") await onAssigned();
      return true;
    } catch (e) {
      setError(e?.message || "Could not assign courier.");
      return false;
    } finally {
      setAssigningId(null);
    }
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

  return (
    <div className={`space-y-2 ${compact ? "" : "md:space-y-2.5"}`}>
      <p className={`font-medium text-neutral-800 dark:text-slate-200 ${compact ? "text-[11px]" : "text-xs"}`}>{heading}</p>
      {error ? (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className={`text-neutral-500 dark:text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>Loading couriers…</p>
      ) : sorted.length === 0 ? (
        <p className={`text-neutral-600 dark:text-slate-400 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          No couriers are Available or Active right now. Try again soon or deliver yourself.
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-0.5">
          {sorted.map((c) => {
            const modesLine = formatCourierModesForDisplay(c.modes);
            return (
            <li
              key={String(c.id)}
              className="flex items-center gap-2 rounded-lg border border-neutral-200/80 bg-white/60 px-2 py-1.5 dark:border-slate-600/70 dark:bg-slate-900/40"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none ring-brand-primary/0 transition hover:bg-neutral-50/80 focus-visible:ring-2 dark:hover:bg-slate-800/50 dark:focus-visible:ring-brand-accent/40"
                onClick={() => setProfileCourier(c)}
              >
                <StableAvatar
                  src={c.avatarUrl || ""}
                  alt=""
                  initials={(String(c.displayName || c.username || "?").trim().charAt(0) || "?").toUpperCase()}
                  className="h-9 w-9 shrink-0 text-xs"
                  sizes="36px"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-neutral-900 dark:text-slate-100">
                    {c.displayName || c.username || "Member"}
                  </p>
                  <p className="truncate text-[10px] text-neutral-500 dark:text-slate-500">
                    {c.courierStatus === "active" ? "Active — on the move" : "Available"}
                    {typeof c.completedDeliveries === "number" && c.completedDeliveries > 0
                      ? ` · ${c.completedDeliveries} completed`
                      : ""}
                    {modesLine ? ` · ${modesLine}` : ""}
                  </p>
                  {Array.isArray(c.badges) && c.badges.length ? (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c.badges.map((b) => (
                        <span
                          key={b.id}
                          className="rounded-full bg-amber-100/95 px-1.5 py-0.5 text-[9px] font-semibold text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/50"
                          title="Earned from completed deliveries"
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(c.optionalTags) && c.optionalTags.length ? (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c.optionalTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                        >
                          {COURIER_OPTIONAL_TAG_LABEL[t] || t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 shrink-0 px-2.5 py-1 text-[11px]"
                loading={assigningId === c.id}
                loadingLabel="…"
                disabled={Boolean(assigningId)}
                onClick={() => void assign(c.id)}
              >
                {assignButtonLabel}
              </Button>
            </li>
            );
          })}
        </ul>
      )}
      <CourierPublicProfileModal
        open={Boolean(profileCourier)}
        courier={profileCourier}
        onClose={() => setProfileCourier(null)}
        footer={
          profileCourier && orderId ? (
            <Button
              type="button"
              variant="primary"
              className="w-full"
              loading={assigningId === profileCourier.id}
              loadingLabel="…"
              disabled={Boolean(assigningId)}
              onClick={() => {
                void (async () => {
                  const ok = await assign(profileCourier.id);
                  if (ok) setProfileCourier(null);
                })();
              }}
            >
              {assignButtonLabel}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
