-- Persist sold quantity per listing for product/detail UX.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

-- Backfill safety for legacy rows.
UPDATE public.listings
SET sold_count = 0
WHERE sold_count IS NULL OR sold_count < 0;
