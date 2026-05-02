import { useEffect, useState } from "react";

const TAGS = [
  { id: "fast", label: "Fast" },
  { id: "late", label: "Late" },
  { id: "friendly", label: "Friendly" },
];

/**
 * Buyer rating for the community courier on this order (tied to the accepted assignment).
 *
 * @param {object} props
 * @param {string} props.orderId
 * @param {object} [props.initialReview]
 * @param {function} props.onSubmit (orderId, rating, tags, abuseNote) => Promise<void>
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact]
 */
export function CourierDeliveryReviewForm({ orderId, initialReview, onSubmit, disabled, compact = false }) {
  const [rating, setRating] = useState(() => initialReview?.rating || 0);
  const [tagSet, setTagSet] = useState(() => new Set(Array.isArray(initialReview?.tags) ? initialReview.tags : []));
  const [abuseNote, setAbuseNote] = useState(() => String(initialReview?.abuseNote || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRating(initialReview?.rating || 0);
    setTagSet(new Set(Array.isArray(initialReview?.tags) ? initialReview.tags : []));
    setAbuseNote(String(initialReview?.abuseNote || ""));
  }, [orderId, initialReview?.rating, initialReview?.tags, initialReview?.abuseNote]);

  const toggleTag = (id) => {
    setTagSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!rating || saving || disabled) return;
    setSaving(true);
    try {
      const tags = TAGS.map((t) => t.id).filter((id) => tagSet.has(id));
      await onSubmit(orderId, rating, tags, abuseNote.trim());
    } finally {
      setSaving(false);
    }
  };

  const hasSaved = Boolean(initialReview?.rating);
  const ratingMissing = !rating;
  const reported = Boolean(initialReview?.abuseReportedAt);

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-lg border border-violet-200/80 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/30 ${
        compact ? "p-2 md:p-2.5" : "p-2.5 md:p-3"
      }`}
    >
      <p
        className={`font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200 ${
          compact ? "text-[10px] leading-tight" : "text-[11px]"
        }`}
      >
        {hasSaved ? "Your courier rating" : "Rate the community courier"}
      </p>
      <p className="mt-0.5 text-[10px] text-neutral-600 dark:text-slate-400">
        One review per delivery run. This is stored on the courier’s assignment, not the product review above.
      </p>

      <div
        className={`flex flex-wrap items-center gap-0.5 md:justify-start ${compact ? "mt-1 justify-center" : "mt-2 justify-center gap-1"}`}
        role="group"
        aria-label="Courier star rating"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled || saving}
            onClick={() => setRating(n)}
            className={`touch-manipulation rounded px-0.5 leading-none transition ${
              compact
                ? "min-h-8 min-w-8 text-base md:min-h-9 md:min-w-9 md:text-lg"
                : "min-h-10 min-w-10 text-lg md:min-h-11 md:min-w-11 md:text-xl"
            } ${
              n <= rating ? "text-amber-500" : "text-neutral-300 dark:text-slate-600"
            } ${disabled || saving ? "cursor-not-allowed opacity-55" : "hover:text-amber-400"}`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={n <= rating}
          >
            ★
          </button>
        ))}
        {rating ? (
          <span
            className={`w-full basis-full text-center text-neutral-600 md:ml-1 md:w-auto md:basis-auto md:text-left dark:text-slate-400 ${
              compact ? "text-[10px] md:text-xs" : "text-xs"
            }`}
          >
            {rating} / 5
          </span>
        ) : null}
      </div>

      <div className={compact ? "mt-1.5" : "mt-2"}>
        <p className={`font-medium text-neutral-700 dark:text-slate-300 ${compact ? "text-[10px]" : "text-xs"}`}>Tags</p>
        <div className={`mt-1 flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
          {TAGS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled || saving}
              onClick={() => toggleTag(t.id)}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                tagSet.has(t.id)
                  ? "border-violet-500 bg-violet-500/15 text-violet-900 dark:border-violet-400 dark:bg-violet-900/40 dark:text-violet-100"
                  : "border-neutral-200 bg-white/80 text-neutral-600 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? "mt-2" : "mt-3"}>
        <label htmlFor={`courier-abuse-${orderId}`} className="label-base text-[11px]">
          Report a problem (optional)
        </label>
        <textarea
          id={`courier-abuse-${orderId}`}
          value={abuseNote}
          onChange={(e) => setAbuseNote(e.target.value)}
          disabled={disabled || saving}
          maxLength={500}
          rows={compact ? 2 : 2}
          placeholder="If something went wrong, leave a short note for moderators. You can add this after you submit your stars."
          className="textarea-base mt-0.5 min-h-[3rem] w-full resize-y px-2 py-1.5 text-[12px] leading-snug dark:bg-slate-950"
        />
        {reported ? (
          <p className="mt-1 text-[10px] text-neutral-500 dark:text-slate-500">A report was recorded on file — moderators may follow up.</p>
        ) : null}
      </div>

      <div className={`flex justify-stretch md:justify-end ${compact ? "mt-2 md:mt-1.5" : "mt-3 md:mt-2"}`}>
        <button
          type="submit"
          disabled={ratingMissing || disabled || saving}
          aria-busy={saving || undefined}
          className={`btn-primary w-full touch-manipulation md:w-auto ${compact ? "min-h-10 text-xs md:min-h-[44px]" : "min-h-[44px] text-sm"}`}
        >
          {saving ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                aria-hidden
              />
              Saving…
            </span>
          ) : hasSaved ? (
            "Update courier review"
          ) : (
            "Submit courier review"
          )}
        </button>
      </div>
    </form>
  );
}
