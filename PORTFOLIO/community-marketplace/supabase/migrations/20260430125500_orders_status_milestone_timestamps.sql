-- When the order entered processing, completed, or cancelled (clearer than `updated_at` alone).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS processing_entered_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

UPDATE public.orders SET completed_at = updated_at WHERE status = 'completed' AND completed_at IS NULL;
UPDATE public.orders SET cancelled_at = updated_at WHERE status = 'cancelled' AND cancelled_at IS NULL;
