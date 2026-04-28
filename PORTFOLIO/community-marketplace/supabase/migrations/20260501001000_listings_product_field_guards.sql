-- Harden Add Product fields with consistent constraints.
ALTER TABLE public.listings
  ALTER COLUMN image_urls SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN option_values_a SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN option_values_b SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN order_type SET DEFAULT 'in_stock',
  ALTER COLUMN processing_time SET DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_processing_time_for_preorder_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_processing_time_for_preorder_check
      CHECK (
        order_type <> 'pre_order'
        OR COALESCE(NULLIF(BTRIM(processing_time), ''), '') <> ''
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_option_a_name_required_when_values_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_option_a_name_required_when_values_check
      CHECK (
        COALESCE(array_length(option_values_a, 1), 0) = 0
        OR COALESCE(NULLIF(BTRIM(option_name_a), ''), '') <> ''
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_option_b_name_required_when_values_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_option_b_name_required_when_values_check
      CHECK (
        COALESCE(array_length(option_values_b, 1), 0) = 0
        OR COALESCE(NULLIF(BTRIM(option_name_b), ''), '') <> ''
      );
  END IF;
END $$;
