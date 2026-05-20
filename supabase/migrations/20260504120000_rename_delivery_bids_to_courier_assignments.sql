-- Rename legacy delivery_bids -> courier_assignments and orders.accepted_bid_id -> accepted_courier_assignment_id.
-- Idempotent for partially-applied environments.

DO $$
BEGIN
  IF to_regclass('public.delivery_bids') IS NOT NULL THEN
    DROP POLICY IF EXISTS bids_select_related ON public.delivery_bids;
    DROP POLICY IF EXISTS bids_insert_courier ON public.delivery_bids;
    DROP POLICY IF EXISTS bids_update_courier ON public.delivery_bids;
    ALTER TABLE public.delivery_bids RENAME TO courier_assignments;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'delivery_bids_order_idx'
  ) THEN
    ALTER INDEX public.delivery_bids_order_idx RENAME TO courier_assignments_order_idx;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'accepted_bid_id'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN accepted_bid_id TO accepted_courier_assignment_id;
  END IF;
END $$;

ALTER TABLE public.courier_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bids_select_related ON public.courier_assignments;
DROP POLICY IF EXISTS bids_insert_courier ON public.courier_assignments;
DROP POLICY IF EXISTS bids_update_courier ON public.courier_assignments;
DROP POLICY IF EXISTS courier_assignments_select_related ON public.courier_assignments;
DROP POLICY IF EXISTS courier_assignments_insert_own ON public.courier_assignments;
DROP POLICY IF EXISTS courier_assignments_update_own ON public.courier_assignments;

CREATE POLICY courier_assignments_select_related ON public.courier_assignments FOR SELECT TO authenticated USING (
  courier_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

CREATE POLICY courier_assignments_insert_own ON public.courier_assignments FOR INSERT TO authenticated WITH CHECK (courier_id = auth.uid());

CREATE POLICY courier_assignments_update_own ON public.courier_assignments FOR UPDATE TO authenticated USING (courier_id = auth.uid());

NOTIFY pgrst, 'reload schema';
