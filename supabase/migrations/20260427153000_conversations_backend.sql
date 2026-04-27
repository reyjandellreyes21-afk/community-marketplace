-- Backend conversations (direct + order chat) for community-marketplace API.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'order')),
  order_id uuid REFERENCES public.orders (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type = 'order' AND order_id IS NOT NULL)
    OR (type = 'direct' AND order_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_order_id_idx ON public.conversations (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_order_unique_idx ON public.conversations (order_id) WHERE type = 'order';

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'buyer', 'seller', 'courier')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_user_idx ON public.conversation_participants (user_id);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx
  ON public.conversation_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_read_message_id uuid REFERENCES public.conversation_messages (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_reads_user_idx ON public.conversation_reads (user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS conversations_insert_authenticated ON public.conversations;
CREATE POLICY conversations_insert_authenticated ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS conversations_update_participant ON public.conversations;
CREATE POLICY conversations_update_participant ON public.conversations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS participants_select_own_or_conversation ON public.conversation_participants;
CREATE POLICY participants_select_own_or_conversation ON public.conversation_participants
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS participants_insert_self ON public.conversation_participants;
CREATE POLICY participants_insert_self ON public.conversation_participants
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS messages_select_participant ON public.conversation_messages;
CREATE POLICY messages_select_participant ON public.conversation_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS messages_insert_sender_participant ON public.conversation_messages;
CREATE POLICY messages_insert_sender_participant ON public.conversation_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_messages.conversation_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS reads_select_own ON public.conversation_reads;
CREATE POLICY reads_select_own ON public.conversation_reads
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS reads_upsert_own ON public.conversation_reads;
CREATE POLICY reads_upsert_own ON public.conversation_reads
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reads_update_own ON public.conversation_reads;
CREATE POLICY reads_update_own ON public.conversation_reads
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
