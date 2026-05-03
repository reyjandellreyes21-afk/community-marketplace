-- In-app product feedback: user experience, improvements, and concerns (separate from order/seller reviews).
CREATE TABLE IF NOT EXISTS public.app_experience_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN ('experience', 'improvement', 'concern', 'other')),
  message text NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 8000),
  client_platform text
    CHECK (client_platform IS NULL OR char_length(client_platform) <= 64),
  user_agent text
    CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_experience_feedback_user_id_created_idx
  ON public.app_experience_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_experience_feedback_category_created_idx
  ON public.app_experience_feedback (category, created_at DESC);

ALTER TABLE public.app_experience_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_experience_feedback_insert_own ON public.app_experience_feedback;
CREATE POLICY app_experience_feedback_insert_own
  ON public.app_experience_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS app_experience_feedback_select_own ON public.app_experience_feedback;
CREATE POLICY app_experience_feedback_select_own
  ON public.app_experience_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.app_experience_feedback IS 'User-submitted app experience feedback (not order reviews).';
