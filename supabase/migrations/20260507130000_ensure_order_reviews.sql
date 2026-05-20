-- Repair environments where `order_reviews` was never created or PostgREST still has a stale cache.
-- Error: "Could not find the table 'public.order_reviews' in the schema cache" (PGRST205)

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

NOTIFY pgrst, 'reload schema';
