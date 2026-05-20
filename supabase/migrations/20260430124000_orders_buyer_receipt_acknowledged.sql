-- Optional buyer acknowledgment during pickup (does not complete the order; seller still marks pickup complete).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_receipt_acknowledged_at timestamptz;
