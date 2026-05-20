-- Repair / ensure `order_reviews` matches the API (product_rating + seller_rating per order).
-- Run if PUT /orders/:id/review fails or PostgREST reports unknown columns.
-- Safe to re-run (idempotent). Pair with: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public.order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS order_reviews_seller_idx ON public.order_reviews (seller_id);
CREATE INDEX IF NOT EXISTS order_reviews_listing_idx ON public.order_reviews (listing_id);

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_reviews_select_parties ON public.order_reviews;
CREATE POLICY order_reviews_select_parties ON public.order_reviews FOR SELECT TO authenticated USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

DROP POLICY IF EXISTS order_reviews_insert_buyer ON public.order_reviews;
CREATE POLICY order_reviews_insert_buyer ON public.order_reviews FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS order_reviews_update_buyer ON public.order_reviews;
CREATE POLICY order_reviews_update_buyer ON public.order_reviews FOR UPDATE TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

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

NOTIFY pgrst, 'reload schema';
