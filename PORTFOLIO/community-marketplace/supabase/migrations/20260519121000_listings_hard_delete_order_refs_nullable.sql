-- Allow listing rows to be hard-deleted while preserving order and review history.
-- Historical orders keep their own buyer/seller/status/amount fields; listing lookups become null.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_listing_id_fkey;

ALTER TABLE public.orders
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

ALTER TABLE public.order_reviews DROP CONSTRAINT IF EXISTS order_reviews_listing_id_fkey;

ALTER TABLE public.order_reviews
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.order_reviews
  ADD CONSTRAINT order_reviews_listing_id_fkey
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_listing_idx ON public.orders (listing_id);
CREATE INDEX IF NOT EXISTS order_reviews_listing_idx ON public.order_reviews (listing_id);

NOTIFY pgrst, 'reload schema';
