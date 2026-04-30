-- Repair environments where `image_urls` was never applied (PostgREST: column not in schema cache).
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.listings
SET image_urls = ARRAY[image_url]
WHERE COALESCE(array_length(image_urls, 1), 0) = 0
  AND COALESCE(TRIM(image_url), '') <> '';

NOTIFY pgrst, 'reload schema';
