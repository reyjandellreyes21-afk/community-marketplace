-- Seller dashboard ledger entries for manual/external business events.
-- Supports income/expense outside the app and optional stock adjustments.

CREATE TABLE IF NOT EXISTS public.seller_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('income', 'expense', 'stock_in', 'stock_out')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'in_app')),
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  quantity_delta integer NOT NULL DEFAULT 0,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  item_name text NOT NULL DEFAULT '' CHECK (char_length(item_name) <= 200),
  category text NOT NULL DEFAULT 'general' CHECK (char_length(category) <= 64),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_ledger_entries_seller_occurred_idx
  ON public.seller_ledger_entries (seller_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS seller_ledger_entries_seller_type_idx
  ON public.seller_ledger_entries (seller_id, entry_type, occurred_at DESC);

ALTER TABLE public.seller_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_ledger_entries_own ON public.seller_ledger_entries;
CREATE POLICY seller_ledger_entries_own
ON public.seller_ledger_entries
FOR ALL
TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

NOTIFY pgrst, 'reload schema';
