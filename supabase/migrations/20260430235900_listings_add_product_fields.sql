-- Persist Add Product advanced fields directly on listings.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS option_name_a text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS option_values_a text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS option_name_b text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS option_values_b text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS processing_time text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_order_type_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_order_type_check
      CHECK (order_type IN ('in_stock', 'pre_order'));
  END IF;
END $$;

-- Backfill image_urls from existing primary image_url when available.
UPDATE public.listings
SET image_urls = ARRAY[image_url]
WHERE COALESCE(array_length(image_urls, 1), 0) = 0
  AND COALESCE(TRIM(image_url), '') <> '';
