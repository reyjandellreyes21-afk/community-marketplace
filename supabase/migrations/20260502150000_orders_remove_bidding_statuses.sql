-- Retire fee-bidding status names: bidding_open -> seller_accepted, bid_accepted -> courier_assigned.
-- Drop the old status whitelist first so UPDATE ... courier_assigned cannot violate the legacy CHECK.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orders'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%status IN (%'
      AND pg_get_constraintdef(c.oid) LIKE '%placed%'
      AND pg_get_constraintdef(c.oid) LIKE '%seller_accepted%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.orders SET status = 'seller_accepted' WHERE status = 'bidding_open';
UPDATE public.orders SET status = 'courier_assigned' WHERE status = 'bid_accepted';

ALTER TABLE public.orders ADD CONSTRAINT orders_status_allowed_values_check CHECK (
  status IN (
    'placed',
    'seller_accepted',
    'courier_assigned',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled'
  )
);
