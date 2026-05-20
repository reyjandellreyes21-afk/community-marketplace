-- Persist Purchases / Orders badge + highlight queues per user (survives logout on next login).

CREATE TABLE IF NOT EXISTS public.user_order_attention (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  buyer_attention jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_attention jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_order_attention_updated_idx ON public.user_order_attention (updated_at DESC);

ALTER TABLE public.user_order_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_order_attention_select_own ON public.user_order_attention;
CREATE POLICY user_order_attention_select_own ON public.user_order_attention
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_insert_own ON public.user_order_attention;
CREATE POLICY user_order_attention_insert_own ON public.user_order_attention
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_update_own ON public.user_order_attention;
CREATE POLICY user_order_attention_update_own ON public.user_order_attention
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_delete_own ON public.user_order_attention;
CREATE POLICY user_order_attention_delete_own ON public.user_order_attention
  FOR DELETE TO authenticated USING (user_id = auth.uid());
