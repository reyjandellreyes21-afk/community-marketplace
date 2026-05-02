-- Repair environments missing buyer→courier reviews or stale PostgREST cache.
-- Error: "Could not find the table 'public.courier_delivery_reviews' in the schema cache" (PGRST205)

CREATE TABLE IF NOT EXISTS public.courier_delivery_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_assignment_id uuid NOT NULL REFERENCES public.courier_assignments (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  abuse_note text,
  abuse_reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> courier_id),
  CONSTRAINT courier_delivery_reviews_one_per_assignment UNIQUE (courier_assignment_id),
  CONSTRAINT courier_delivery_reviews_tags_subset CHECK (tags <@ ARRAY['fast', 'late', 'friendly']::text[])
);

CREATE INDEX IF NOT EXISTS courier_delivery_reviews_order_idx ON public.courier_delivery_reviews (order_id);
CREATE INDEX IF NOT EXISTS courier_delivery_reviews_courier_idx ON public.courier_delivery_reviews (courier_id);
CREATE INDEX IF NOT EXISTS courier_delivery_reviews_buyer_idx ON public.courier_delivery_reviews (buyer_id);

COMMENT ON TABLE public.courier_delivery_reviews IS 'Buyer feedback for a specific courier run (assignment), after order completes.';
COMMENT ON COLUMN public.courier_delivery_reviews.tags IS 'Subset of: fast, late, friendly.';
COMMENT ON COLUMN public.courier_delivery_reviews.abuse_note IS 'Optional moderation report; abuse_reported_at set when first submitted.';

ALTER TABLE public.courier_delivery_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courier_delivery_reviews_select_buyer_courier ON public.courier_delivery_reviews;
CREATE POLICY courier_delivery_reviews_select_buyer_courier ON public.courier_delivery_reviews FOR SELECT TO authenticated USING (
  buyer_id = auth.uid() OR courier_id = auth.uid()
);

DROP POLICY IF EXISTS courier_delivery_reviews_insert_buyer ON public.courier_delivery_reviews;
CREATE POLICY courier_delivery_reviews_insert_buyer ON public.courier_delivery_reviews FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS courier_delivery_reviews_update_buyer ON public.courier_delivery_reviews;
CREATE POLICY courier_delivery_reviews_update_buyer ON public.courier_delivery_reviews FOR UPDATE TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

NOTIFY pgrst, 'reload schema';
