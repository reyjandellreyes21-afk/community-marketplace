-- Tie listings to a neighborhood (optional FK; null = legacy / global browse).

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listings_community_idx ON public.listings (community_id) WHERE community_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
