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

function buyerInitials(displayName) {
  const s = String(displayName || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}

/**
 * Profile → Feedback: read-only list of buyer reviews (order_reviews) for this seller.
 */
export function SellerBuyerFeedbackList({ token, sellerId = "" }) {
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
    const targetSellerId = String(sellerId || "").trim();
    (async () => {
      try {
        const endpoint = targetSellerId
          ? `/seller/${encodeURIComponent(targetSellerId)}/buyer-feedback`
          : "/me/seller/buyer-feedback";
        const data = await apiRequest(endpoint, { token });
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
  }, [token, sellerId]);

  if (!token) {
    return <p className="text-sm text-neutral-600 dark:text-slate-400">Sign in to see buyer feedback.</p>;
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
        <span className="font-medium text-neutral-800 dark:text-slate-200">No buyer feedback yet.</span> Buyers can leave a rating or note after a completed sale.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-slate-400">
        Ratings and comments buyers left on completed orders (COD).
      </p>
      <ul className="space-y-3">
        {items.map((row) => (
          <li
            key={row.orderId}
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
            {row.reviewText ? (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-slate-300">{row.reviewText}</p>
            ) : (
              <p className="mt-3 text-sm italic text-neutral-500 dark:text-slate-500">No written comment.</p>
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
