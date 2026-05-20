-- Deliver notifications row changes to Supabase Realtime clients (filter by user_id in the app).
-- Safe to re-run in CI if publication membership already exists.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
