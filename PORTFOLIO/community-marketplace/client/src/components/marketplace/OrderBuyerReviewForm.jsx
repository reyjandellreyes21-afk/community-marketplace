import { useEffect, useState } from "react";

import { buyerReviewCardShell, buyerReviewSectionSubtitle, buyerReviewSectionTitle } from "./buyerReviewSectionClasses.js";
import { RatingAutosizeTextarea } from "./RatingAutosizeTextarea.jsx";

function StarRow({
  value,
  onChange,
  disabled,
  saving,
  compact,
  ariaLabel,
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 md:justify-start ${compact ? "mt-1 justify-center" : "mt-2 justify-center gap-1"}`}
      role="group"
      aria-label={ariaLabel}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled || saving}
          onClick={() => onChange(n)}
          className={`touch-manipulation rounded px-0.5 leading-none transition ${
            compact
              ? "min-h-8 min-w-8 text-base md:min-h-9 md:min-w-9 md:text-lg"
              : "min-h-10 min-w-10 text-lg md:min-h-11 md:min-w-11 md:text-xl"
          } ${
            n <= value ? "text-amber-500" : "text-neutral-300 dark:text-slate-600"
          } ${disabled || saving ? "cursor-not-allowed opacity-55" : "hover:text-amber-400"}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={n <= value}
        >
          ★
        </button>
      ))}
      {value ? (
        <span
          className={`w-full basis-full text-center text-neutral-600 md:ml-1 md:w-auto md:basis-auto md:text-left dark:text-slate-400 ${
            compact ? "text-[10px] md:text-xs" : "text-xs"
          }`}
        >
          {value} / 5
        </span>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.orderId
 * @param {object} [props.initialReview]
 * @param {function} props.onSubmit — `(orderId, body) => Promise<void>` with partial `{ productRating?, productReviewText?, sellerRating?, sellerReviewText? }`
 * @param {boolean} [props.showSellerSection] — whether to display the seller rating block for this order.
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.compact]
 */
export function OrderBuyerReviewForm({
  orderId,
  initialReview,
  onSubmit,
  disabled,
  compact = false,
  showSellerSection = true,
}) {
  const [productRating, setProductRating] = useState(() => initialReview?.productRating || 0);
  const [productText, setProductText] = useState(() => String(initialReview?.productReviewText || ""));
  const [sellerRating, setSellerRating] = useState(() => initialReview?.sellerRating || 0);
  const [sellerText, setSellerText] = useState(() => String(initialReview?.sellerReviewText || ""));
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingSeller, setSavingSeller] = useState(false);

  useEffect(() => {
    setProductRating(initialReview?.productRating || 0);
    setProductText(String(initialReview?.productReviewText || ""));
    setSellerRating(initialReview?.sellerRating || 0);
    setSellerText(String(initialReview?.sellerReviewText || ""));
  }, [
    orderId,
    initialReview?.productRating,
    initialReview?.productReviewText,
    initialReview?.sellerRating,
    initialReview?.sellerReviewText,
  ]);

  const submitProduct = async (ev) => {
    ev.preventDefault();
    if (!productRating || savingProduct || disabled) return;
    setSavingProduct(true);
    try {
      await onSubmit(orderId, {
        productRating,
        productReviewText: productText.trim(),
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const submitSeller = async (ev) => {
    ev.preventDefault();
    if (!sellerRating || savingSeller || disabled) return;
    setSavingSeller(true);
    try {
      await onSubmit(orderId, {
        sellerRating,
        sellerReviewText: sellerText.trim(),
      });
    } finally {
      setSavingSeller(false);
    }
  };

  const productSaved = Boolean(initialReview?.productRating);
  const sellerSaved = Boolean(initialReview?.sellerRating);
  const productCanEdit = initialReview?.productCanEdit !== false;
  const sellerCanEdit = initialReview?.sellerCanEdit !== false;
  const showProductForm = !productSaved || productCanEdit;
  const showSellerForm = showSellerSection && (!sellerSaved || sellerCanEdit);

  return (
    <div className="space-y-4">
      {showProductForm ? (
      <form
        onSubmit={submitProduct}
        noValidate
        className={buyerReviewCardShell(compact)}
      >
        <p className={buyerReviewSectionTitle(compact)}>Rate this purchase</p>
        <p className={buyerReviewSectionSubtitle(compact)}>
          Stars for the item you bought—counts toward this listing (each purchase).
        </p>
        <StarRow
          value={productRating}
          onChange={setProductRating}
          disabled={disabled}
          saving={savingProduct}
          compact={compact}
          ariaLabel="Product star rating"
        />
        <div className={compact ? "mt-1.5" : "mt-2"}>
          <label htmlFor={`order-review-product-${orderId}`} className="label-base">
            Comment (optional)
          </label>
          <RatingAutosizeTextarea
            id={`order-review-product-${orderId}`}
            value={productText}
            onChange={(e) => setProductText(e.target.value)}
            disabled={disabled || savingProduct}
            maxLength={2000}
            placeholder="Quality, accuracy, packaging…"
            enterKeyHint="done"
            compact={compact}
          />
        </div>
        <div className={`flex justify-stretch md:justify-end ${compact ? "mt-2 md:mt-1.5" : "mt-3 md:mt-2"}`}>
          <button
            type="submit"
            disabled={!productRating || disabled || savingProduct}
            aria-busy={savingProduct || undefined}
            className={`btn-primary w-full touch-manipulation md:w-auto ${compact ? "min-h-10 text-xs md:min-h-[44px]" : "min-h-[44px] text-sm"}`}
          >
            {savingProduct ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                  aria-hidden
                />
                Saving…
              </span>
            ) : productSaved ? (
              "Update purchase rating"
            ) : (
              "Save purchase rating"
            )}
          </button>
        </div>
      </form>
      ) : null}

      {showSellerForm ? (
      <form
        onSubmit={submitSeller}
        noValidate
        className={buyerReviewCardShell(compact)}
      >
        <p className={buyerReviewSectionTitle(compact)}>Rate the seller</p>
        <p className={buyerReviewSectionSubtitle(compact)}>
          Stars for this completed purchase; affects the seller’s shop reputation.
        </p>
        <StarRow
          value={sellerRating}
          onChange={setSellerRating}
          disabled={disabled}
          saving={savingSeller}
          compact={compact}
          ariaLabel="Seller star rating"
        />
        <div className={compact ? "mt-1.5" : "mt-2"}>
          <label htmlFor={`order-review-seller-${orderId}`} className="label-base">
            Comment (optional)
          </label>
          <RatingAutosizeTextarea
            id={`order-review-seller-${orderId}`}
            value={sellerText}
            onChange={(e) => setSellerText(e.target.value)}
            disabled={disabled || savingSeller}
            maxLength={2000}
            placeholder="Communication, reliability…"
            enterKeyHint="done"
            compact={compact}
          />
        </div>
        <div className={`flex justify-stretch md:justify-end ${compact ? "mt-2 md:mt-1.5" : "mt-3 md:mt-2"}`}>
          <button
            type="submit"
            disabled={!sellerRating || disabled || savingSeller}
            aria-busy={savingSeller || undefined}
            className={`btn-primary w-full touch-manipulation md:w-auto ${compact ? "min-h-10 text-xs md:min-h-[44px]" : "min-h-[44px] text-sm"}`}
          >
            {savingSeller ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
                  aria-hidden
                />
                Saving…
              </span>
            ) : sellerSaved ? (
              "Update seller rating"
            ) : (
              "Save seller rating"
            )}
          </button>
        </div>
      </form>
      ) : showSellerSection && sellerSaved && !sellerCanEdit ? (
        <div
          className={`rounded-lg border border-neutral-200/60 bg-neutral-50/50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/30 ${
            compact ? "text-[10px]" : "text-xs"
          } text-neutral-600 dark:text-slate-400`}
        >
          Seller rating edit window ended (72 hours).
        </div>
      ) : !showSellerSection ? (
        <div
          className={`rounded-lg border border-neutral-200/60 bg-neutral-50/50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/30 ${
            compact ? "text-[10px]" : "text-xs"
          } text-neutral-600 dark:text-slate-400`}
        >
          Seller rating is not available for this order.
        </div>
      ) : null}
      {productSaved && !productCanEdit ? (
        <div
          className={`rounded-lg border border-neutral-200/60 bg-neutral-50/50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/30 ${
            compact ? "text-[10px]" : "text-xs"
          } text-neutral-600 dark:text-slate-400`}
        >
          Product rating edit window ended (72 hours).
        </div>
      ) : null}
    </div>
  );
}
