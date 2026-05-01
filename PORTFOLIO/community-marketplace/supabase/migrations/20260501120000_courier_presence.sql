-- Courier visibility & optional modes for community-trust delivery (no GPS).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS courier_status text NOT NULL DEFAULT 'offline'
    CHECK (courier_status IN ('offline', 'available', 'active', 'busy')),
  ADD COLUMN IF NOT EXISTS courier_optional_tags text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.profiles.courier_status IS 'offline | available | active | busy — who sees this courier for matching.';
COMMENT ON COLUMN public.profiles.courier_optional_tags IS 'Subset of: eco, bike, fast, helping.';

CREATE INDEX IF NOT EXISTS profiles_courier_status_idx ON public.profiles (courier_status)
  WHERE courier_status IN ('available', 'active');
