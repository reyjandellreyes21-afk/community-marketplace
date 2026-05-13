-- Add `provider_on_the_way` to the orders.status whitelist.
--
-- Service-booking 5-stage pipeline (all service-vertical orders, including transport_services):
--   placed → seller_accepted → provider_on_the_way → ready_for_pickup → completed
--
-- Notes:
--   • `mark_ready_for_pickup` is reused for the service-booking "Arrived" milestone — accepted from
--     either `seller_accepted` or `provider_on_the_way` (see marketplaceController.js).
--   • Product orders never enter `provider_on_the_way`; their flow is unchanged.
--   • Partial unique index `orders_listing_service_slot_active_uidx` already treats this value as
--     "active" because it filters on `status NOT IN ('completed','cancelled')`.

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
      AND pg_get_constraintdef(c.oid) NOT LIKE '%provider_on_the_way%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orders'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%provider_on_the_way%'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_allowed_values_check CHECK (
      status IN (
        'placed',
        'seller_accepted',
        'courier_assigned',
        'provider_on_the_way',
        'ready_for_pickup',
        'out_for_delivery',
        'completed',
        'cancelled'
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
