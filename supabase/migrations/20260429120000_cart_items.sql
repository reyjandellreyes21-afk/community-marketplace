-- Shopping cart: one row per (buyer, listing). Server merges quantity on repeat adds.

CREATE TABLE IF NOT EXISTS public.cart_items (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items (user_id);
CREATE INDEX IF NOT EXISTS cart_items_listing_idx ON public.cart_items (listing_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cart_items_all_own ON public.cart_items;
CREATE POLICY cart_items_all_own ON public.cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
