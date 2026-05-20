-- Remote drift catch-up for partially migrated databases (missing columns / stale stubs).
-- Idempotent: safe to re-run. Does not delete application data except empty broken stubs (see below).

-- --- Accidental artifact from exploratory SQL ---
DROP TABLE IF EXISTS public.missing_table;

-- --- cart_items.fulfillment_type + CHECK (repair if column existed without constraint) ---
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'pickup';

DO $$
BEGIN
  ALTER TABLE public.cart_items
    ADD CONSTRAINT cart_items_fulfillment_type_check
    CHECK (fulfillment_type IN ('pickup', 'delivery'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.cart_items.fulfillment_type IS
  'Buyer choice for COD pickup vs delivery; must be allowed by listings.fulfillment_modes.';

-- --- conversation_messages soft-edit / soft-delete ---
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- --- notifications: ensure table exists, then add any missing columns from 20260427154500_notifications_backend.sql ---
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  type text NOT NULL CHECK (char_length(type) >= 1 AND char_length(type) <= 80),
  entity_type text NOT NULL DEFAULT '' CHECK (char_length(entity_type) <= 80),
  entity_id uuid,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_len CHECK (char_length(type) >= 1 AND char_length(type) <= 80);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_entity_type_len CHECK (char_length(entity_type) <= 80);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_title_len CHECK (char_length(title) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_body_len CHECK (char_length(body) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.notifications SET type = 'legacy' WHERE type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE type IS NULL) THEN
    ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id IS NULL) THEN
    ALTER TABLE public.notifications ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_type_idx
  ON public.notifications (user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_entity_idx
  ON public.notifications (user_id, entity_type, entity_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_own_or_actor ON public.notifications;
CREATE POLICY notifications_insert_own_or_actor
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR actor_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- --- notification_preferences: recreate only if empty table exists without expected PK column ---
-- Nested IFs so we never query a missing relation (AND does not short-circuit reliably here).
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_preferences'
        AND column_name = 'user_id'
    ) THEN
      IF (SELECT COUNT(*) FROM public.notification_preferences) = 0 THEN
        DROP TABLE public.notification_preferences;
      END IF;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  muted_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  email_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS muted_types text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS in_app_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own
ON public.notification_preferences
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
ON public.notification_preferences
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own
ON public.notification_preferences
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- --- profiles: courier + push prefs ---
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_courier_open_tasks boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notification_token text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notification_platform text;

NOTIFY pgrst, 'reload schema';
