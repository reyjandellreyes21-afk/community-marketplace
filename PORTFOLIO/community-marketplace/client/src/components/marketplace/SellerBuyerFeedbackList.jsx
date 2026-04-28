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

/**
 * Profile → Feedback: read-only list of buyer reviews (order_reviews) for this seller.
 */
export function SellerBuyerFeedbackList({ token }) {
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
        const data = await apiRequest("/me/seller/buyer-feedback", { token });
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
    return (
      <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 text-sm text-neutral-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Sign in to see buyer feedback.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm text-neutral-600 dark:text-slate-400">Loading feedback…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200/90 bg-rose-50/80 p-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-medium text-neutral-800 dark:text-slate-200">No buyer feedback yet</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
          When buyers complete an order and leave a rating or note, it will show up here. You cannot post from this tab — only buyers can leave feedback after a
          completed sale.
        </p>
      </div>
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
                <p className="font-semibold text-neutral-900 dark:text-slate-100">{row.listingTitle}</p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-slate-400">
                  From <span className="font-medium text-neutral-700 dark:text-slate-300">{row.buyerDisplayName}</span>
                  {row.reviewedAt ? (
                    <>
                      {" "}
                      ·{" "}
                      {new Date(row.reviewedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </>
                  ) : null}
                </p>
              </div>
              <Stars rating={row.rating} />
            </div>
            {row.reviewText ? (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-slate-300">{row.reviewText}</p>
            ) : (
              <p className="mt-3 text-sm italic text-neutral-500 dark:text-slate-500">No written comment.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
