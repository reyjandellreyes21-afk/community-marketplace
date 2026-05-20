-- Split buyer feedback into product vs seller (one row per order; each facet optional until submitted).
-- Product aggregates use product_rating; seller reputation uses seller_rating.

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS product_rating smallint,
  ADD COLUMN IF NOT EXISTS seller_rating smallint,
  ADD COLUMN IF NOT EXISTS product_review_text text,
  ADD COLUMN IF NOT EXISTS seller_review_text text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_reviews'
      AND column_name = 'rating'
  ) THEN
    UPDATE public.order_reviews
    SET
      product_rating = COALESCE(product_rating, rating),
      seller_rating = COALESCE(seller_rating, rating),
      product_review_text = CASE
        WHEN product_review_text IS NULL OR TRIM(product_review_text::text) = '' THEN review_text
        ELSE product_review_text
      END,
      seller_review_text = CASE
        WHEN seller_review_text IS NULL OR TRIM(seller_review_text::text) = '' THEN review_text
        ELSE seller_review_text
      END
    WHERE rating IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.order_reviews DROP COLUMN IF EXISTS rating;
ALTER TABLE public.order_reviews DROP COLUMN IF EXISTS review_text;

ALTER TABLE public.order_reviews
  DROP CONSTRAINT IF EXISTS order_reviews_product_rating_chk,
  DROP CONSTRAINT IF EXISTS order_reviews_seller_rating_chk,
  DROP CONSTRAINT IF EXISTS order_reviews_at_least_one_rating_chk;

ALTER TABLE public.order_reviews
  ADD CONSTRAINT order_reviews_product_rating_chk
    CHECK (product_rating IS NULL OR (product_rating >= 1 AND product_rating <= 5)),
  ADD CONSTRAINT order_reviews_seller_rating_chk
    CHECK (seller_rating IS NULL OR (seller_rating >= 1 AND seller_rating <= 5)),
  ADD CONSTRAINT order_reviews_at_least_one_rating_chk
    CHECK (product_rating IS NOT NULL OR seller_rating IS NOT NULL);

COMMENT ON COLUMN public.order_reviews.product_rating IS 'Buyer star rating for the purchased listing (each purchase).';
COMMENT ON COLUMN public.order_reviews.seller_rating IS 'Buyer star rating for the seller on this order (once per order).';
COMMENT ON COLUMN public.order_reviews.product_review_text IS 'Optional comment about the product.';
COMMENT ON COLUMN public.order_reviews.seller_review_text IS 'Optional comment about the seller.';

NOTIFY pgrst, 'reload schema';
