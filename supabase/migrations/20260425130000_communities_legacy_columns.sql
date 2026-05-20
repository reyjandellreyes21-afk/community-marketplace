-- If an older `communities` migration existed with area_description / cover_image_url, migrate to address / image_url and add google_url.

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS google_url text NOT NULL DEFAULT '' CHECK (char_length(google_url) <= 2048);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'area_description'
  ) THEN
    ALTER TABLE public.communities RENAME COLUMN area_description TO address;
  END IF;
END $$;

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'cover_image_url'
  ) THEN
    ALTER TABLE public.communities RENAME COLUMN cover_image_url TO image_url;
  END IF;
END $$;

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 2048);

NOTIFY pgrst, 'reload schema';
