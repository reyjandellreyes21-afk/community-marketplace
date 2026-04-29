import { useEffect, useState } from "react";

/**
 * @param {object} props
 * @param {string} props.orderId
 * @param {object} [props.initialReview]
 * @param {function} props.onSubmit
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact] — tighter spacing for grid/dense order cards
 */
export function OrderBuyerReviewForm({ orderId, initialReview, onSubmit, disabled, compact = false }) {
  const [rating, setRating] = useState(() => initialReview?.rating || 0);
  const [text, setText] = useState(() => String(initialReview?.reviewText || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRating(initialReview?.rating || 0);
    setText(String(initialReview?.reviewText || ""));
  }, [orderId, initialReview?.rating, initialReview?.reviewText]);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!rating || saving || disabled) return;
    setSaving(true);
    try {
      await onSubmit(orderId, rating, text.trim());
    } finally {
      setSaving(false);
    }
  };

  const hasSaved = Boolean(initialReview?.rating);
  const ratingMissing = !rating;

  const textareaClass = compact
    ? "textarea-base min-h-[4.5rem] w-full resize-y px-2 py-2 text-[12px] leading-snug md:min-h-[5.5rem] md:text-xs"
    : "textarea-base w-full resize-y";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`rounded-lg border border-neutral-200/90 bg-neutral-50/80 dark:border-slate-600 dark:bg-slate-900/40 ${
        compact ? "p-2 md:p-2.5" : "p-2.5 md:p-3"
      }`}
    >
      <p
        className={`font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400 ${
          compact ? "text-[10px] leading-tight" : "text-[11px]"
        }`}
      >
        {hasSaved ? "Your rating" : "Rate this purchase"}
      </p>

      <div
        className={`flex flex-wrap items-center gap-0.5 md:justify-start ${compact ? "mt-1 justify-center" : "mt-2 justify-center gap-1"}`}
        role="group"
        aria-label="Star rating"
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
        <label htmlFor={`order-review-comment-${orderId}`} className="label-base">
          Comment (optional)
        </label>
        <textarea
          id={`order-review-comment-${orderId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || saving}
          maxLength={2000}
          rows={compact ? 2 : 3}
          placeholder="Optional: how did pickup or delivery go?"
          enterKeyHint="done"
          className={textareaClass}
        />
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
            "Update review"
          ) : (
            "Submit review"
          )}
        </button>
      </div>
    </form>
  );
}
