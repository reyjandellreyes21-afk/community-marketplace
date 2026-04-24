-- Structured locality for communities (aligned with profile address segments).

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 120);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT '' CHECK (char_length(province) <= 120);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code) <= 32);

NOTIFY pgrst, 'reload schema';
