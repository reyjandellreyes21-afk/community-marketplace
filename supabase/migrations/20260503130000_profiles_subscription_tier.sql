-- Subscription plan tier per user (Basic / Pro / Premium). Default Basic for existing rows.
-- Updated by trusted server paths (e.g. payment webhooks); not client-writable via PATCH /auth/me.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'basic';

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_tier_check
    CHECK (subscription_tier IN ('basic', 'pro', 'premium'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.subscription_tier IS
  'Marketplace plan: basic | pro | premium. Enforced on API; optional RLS for direct Supabase access.';
