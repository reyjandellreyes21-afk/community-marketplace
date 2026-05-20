import { cn } from "../../lib/cn.js";

/**
 * Average buyer→seller star rating (`order_reviews.seller_rating`; hidden when there are no ratings).
 */
export function SellerBuyerRatingSummary({ avg, count, className }) {
  if (typeof avg !== "number" || !Number.isFinite(avg) || !count || count < 1) return null;
  return (
    <p
      className={cn("text-sm", className)}
      role="status"
      aria-label={`Average ${avg.toFixed(1)} out of 5 stars from ${count} buyer ${count === 1 ? "rating" : "ratings"}`}
    >
      <span className="text-amber-500 dark:text-amber-400" aria-hidden>
        ★
      </span>{" "}
      <span className="tabular-nums font-semibold">{avg.toFixed(1)}</span>
      <span className="font-normal text-neutral-500 dark:text-slate-400">
        {" "}
        ({count} {count === 1 ? "rating" : "ratings"})
      </span>
    </p>
  );
}
