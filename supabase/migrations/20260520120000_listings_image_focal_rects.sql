-- Non-destructive thumbnail framing: square region metadata per gallery slot (parallel to image_urls).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS image_focal_rects jsonb NOT NULL DEFAULT '[]'::jsonb;
