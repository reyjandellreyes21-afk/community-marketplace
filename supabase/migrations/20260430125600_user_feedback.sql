-- In-app feedback from authenticated users (seller hub / profile).
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL CHECK (char_length(message) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_user_id_created_idx ON public.user_feedback (user_id, created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_feedback_insert_own ON public.user_feedback;
CREATE POLICY user_feedback_insert_own ON public.user_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_feedback_select_own ON public.user_feedback;
CREATE POLICY user_feedback_select_own ON public.user_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
