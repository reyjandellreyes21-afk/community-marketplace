-- Persist profile -> community relation using UUID for reliable member counts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_community_id_idx ON public.profiles (community_id) WHERE community_id IS NOT NULL;

-- Best-effort backfill from existing text community label.
UPDATE public.profiles p
SET community_id = c.id
FROM public.communities c
WHERE p.community_id IS NULL
  AND nullif(btrim(p.community), '') IS NOT NULL
  AND lower(btrim(p.community)) = lower(btrim(c.name));
