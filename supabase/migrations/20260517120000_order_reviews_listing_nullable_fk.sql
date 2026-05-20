-- Reviews must survive when a listing row is removed or orphaned (admin cleanup, bad imports).
-- Seller feedback stays tied to the order; product_rating may be skipped when listing_id is unknown.

ALTER TABLE public.order_reviews DROP CONSTRAINT IF EXISTS order_reviews_listing_id_fkey;

ALTER TABLE public.order_reviews
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.order_reviews
  ADD CONSTRAINT order_reviews_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_reviews_listing_idx ON public.order_reviews (listing_id);

NOTIFY pgrst, 'reload schema';
