-- Optional buyer note on direct orders (community / marketplace Buy flow).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_comment text NOT NULL DEFAULT '' CHECK (char_length(buyer_comment) <= 2000);
