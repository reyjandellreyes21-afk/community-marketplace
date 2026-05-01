-- Who cancelled, why, and optional note (buyer/seller cancel flows).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by_role text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_note text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancelled_by_role_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_cancelled_by_role_check
  CHECK (cancelled_by_role IS NULL OR cancelled_by_role IN ('buyer', 'seller'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancellation_reason_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_cancellation_reason_check
  CHECK (
    cancellation_reason IS NULL
    OR cancellation_reason IN (
      'change_of_mind',
      'change_variant',
      'better_price_elsewhere',
      'placed_by_mistake',
      'other'
    )
  );

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cancellation_note_len;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_cancellation_note_len CHECK (cancellation_note IS NULL OR char_length(cancellation_note) <= 500);
