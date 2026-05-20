-- Neighborhood / subdivision groups (Marketplace). Stored only in `public.communities`, not on profiles.

CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  google_url text NOT NULL DEFAULT '' CHECK (char_length(google_url) <= 2048),
  image_url text NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 2048),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communities_created_at_idx ON public.communities (created_at DESC);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communities_select_all ON public.communities;
CREATE POLICY communities_select_all ON public.communities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS communities_insert_own ON public.communities;
CREATE POLICY communities_insert_own ON public.communities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

GRANT SELECT, INSERT ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;

-- Service role (Express) bypasses RLS; policies apply to direct Supabase client usage.

NOTIFY pgrst, 'reload schema';
