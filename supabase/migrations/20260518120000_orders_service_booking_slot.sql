-- Bookable service slots: persist date/time on orders and prevent double-booking.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_booking_date date;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_booking_time text;

COMMENT ON COLUMN public.orders.service_booking_date IS 'Local calendar date (YYYY-MM-DD) for a service booking when vertical is services.';
COMMENT ON COLUMN public.orders.service_booking_time IS 'Local time slot start HH:mm (24h) for a service booking.';

-- One active pipeline order per listing + slot (completed/cancelled frees the slot).
CREATE UNIQUE INDEX IF NOT EXISTS orders_listing_service_slot_active_uidx
ON public.orders (listing_id, service_booking_date, service_booking_time)
WHERE service_booking_date IS NOT NULL
  AND service_booking_time IS NOT NULL
  AND btrim(service_booking_time) <> ''
  AND status NOT IN ('completed', 'cancelled');
