import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/appApi.js";

function Stars({ rating }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? "text-amber-500 dark:text-amber-400" : "text-neutral-300 dark:text-slate-600"}>
          ★
        </span>
      ))}
    </span>
  );
}

const TAG_LABEL = {
  fast: "Fast",
  late: "Late",
  friendly: "Friendly",
};

function buyerInitials(displayName) {
  const s = String(displayName || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}

/**
 * Activity → Courier: read-only list of buyer ratings for this member’s delivery runs (`courier_delivery_reviews`).
 * Layout matches {@link SellerBuyerFeedbackList} (date, stars, content, buyer profile footer).
 */
export function CourierBuyerFeedbackList({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setItems([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const data = await apiRequest("/me/courier/buyer-feedback", { token });
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(e?.message || "Could not load feedback.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <p className="text-sm text-neutral-600 dark:text-slate-400">Sign in to see courier feedback.</p>;
  }

  if (loading) {
    return <p className="text-sm text-neutral-600 dark:text-slate-400">Loading feedback…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-600 dark:text-slate-400">
        <span className="font-medium text-neutral-800 dark:text-slate-200">No courier feedback yet.</span> Buyers can leave a rating after a completed delivery.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-slate-400">
        Ratings and tags buyers left on completed COD deliveries you fulfilled.
      </p>
      <ul className="space-y-3">
        {items.map((row) => (
          <li
            key={String(row.reviewId || row.orderId)}
            className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-slate-100">
                  {String(row.listingTitle || "Listing").trim() || "Listing"}
                </p>
                {row.reviewedAt ? (
                  <p className="text-xs text-neutral-500 dark:text-slate-400">
                    {new Date(row.reviewedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                ) : null}
              </div>
              <Stars rating={row.rating} />
            </div>
            {Array.isArray(row.tags) && row.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-neutral-200/90 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                  >
                    {TAG_LABEL[t] || t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm italic text-neutral-500 dark:text-slate-500">No tags selected.</p>
            )}
            <div className="mt-4 flex items-center gap-3 border-t border-neutral-200/80 pt-4 dark:border-slate-600/80">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-slate-700">
                {row.buyerAvatarUrl ? (
                  <img
                    src={row.buyerAvatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-600 dark:text-slate-300">
                    {buyerInitials(row.buyerDisplayName)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-slate-100">{row.buyerDisplayName}</p>
                {row.buyerUsername ? (
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-slate-400">@{row.buyerUsername}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
