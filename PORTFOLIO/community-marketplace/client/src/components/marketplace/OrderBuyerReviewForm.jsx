import { useEffect, useState } from "react";



/**

 * @param {object} props

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



  return (

    <form

      onSubmit={handleSubmit}

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

            } ${disabled || saving ? "opacity-50" : "hover:text-amber-400"}`}

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

      <label className={compact ? "mt-1.5 block" : "mt-2 block"}>

        <span className="sr-only">Optional comment</span>

        <textarea

          value={text}

          onChange={(e) => setText(e.target.value)}

          disabled={disabled || saving}

          maxLength={2000}

          rows={2}

          placeholder="Optional: how did pickup or delivery go?"

          className={`w-full resize-y rounded-md border border-neutral-200 bg-white text-neutral-800 placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${

            compact ? "px-1.5 py-1 text-[11px] leading-snug" : "px-2 py-1.5 text-xs"

          }`}

        />

      </label>

      <div className={`flex justify-stretch md:justify-end ${compact ? "mt-2 md:mt-1.5" : "mt-3 md:mt-2"}`}>

        <button

          type="submit"

          disabled={!rating || disabled || saving}

          className={`btn-secondary w-full touch-manipulation text-xs disabled:opacity-50 md:w-auto ${

            compact ? "min-h-9 py-1.5 md:min-h-0" : "min-h-10 md:min-h-0"

          }`}

        >

          {saving ? "Saving…" : hasSaved ? "Update review" : "Submit review"}

        </button>

      </div>

    </form>

  );

}

