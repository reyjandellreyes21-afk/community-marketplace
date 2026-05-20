-- Profile phone verification + OTP storage (API uses service role).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.phone_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verification_challenges_user_idx
  ON public.phone_verification_challenges (user_id);

CREATE INDEX IF NOT EXISTS phone_verification_challenges_expires_idx
  ON public.phone_verification_challenges (expires_at);
