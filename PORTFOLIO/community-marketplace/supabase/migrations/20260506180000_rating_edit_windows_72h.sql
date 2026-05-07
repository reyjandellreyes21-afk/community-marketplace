-- Per-section buyer rating edit windows (72h, fixed from first submit).
-- Adds immutable start timestamps for product/seller/courier rating facets.

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS product_rating_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_rating_started_at timestamptz;

UPDATE public.order_reviews
SET product_rating_started_at = COALESCE(product_rating_started_at, created_at)
WHERE product_rating IS NOT NULL;

UPDATE public.order_reviews
SET seller_rating_started_at = COALESCE(seller_rating_started_at, created_at)
WHERE seller_rating IS NOT NULL;

ALTER TABLE public.courier_delivery_reviews
  ADD COLUMN IF NOT EXISTS rating_started_at timestamptz;

UPDATE public.courier_delivery_reviews
SET rating_started_at = COALESCE(rating_started_at, created_at)
WHERE rating IS NOT NULL;

COMMENT ON COLUMN public.order_reviews.product_rating_started_at IS
  'UTC timestamp when product rating was first submitted; 72h edit window starts here and never resets.';
COMMENT ON COLUMN public.order_reviews.seller_rating_started_at IS
  'UTC timestamp when seller rating was first submitted; 72h edit window starts here and never resets.';
COMMENT ON COLUMN public.courier_delivery_reviews.rating_started_at IS
  'UTC timestamp when courier rating was first submitted; 72h edit window starts here and never resets.';

NOTIFY pgrst, 'reload schema';
