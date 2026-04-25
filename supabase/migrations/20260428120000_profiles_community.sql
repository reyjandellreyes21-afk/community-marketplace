-- Add first-class community field to profiles for reliable member counts.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community text;

-- Helpful index for case-insensitive community lookups/counts.
CREATE INDEX IF NOT EXISTS profiles_community_lower_idx
  ON public.profiles ((lower(community)))
  WHERE community IS NOT NULL AND btrim(community) <> '';

-- Backfill from auth metadata where available.
UPDATE public.profiles p
SET community = nullif(trim(u.raw_user_meta_data->>'community'), '')
FROM auth.users u
WHERE u.id = p.id
  AND (p.community IS NULL OR btrim(p.community) = '')
  AND nullif(trim(u.raw_user_meta_data->>'community'), '') IS NOT NULL;
