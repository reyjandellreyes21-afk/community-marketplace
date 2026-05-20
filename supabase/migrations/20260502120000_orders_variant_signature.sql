-- Persist canonical variant identity on orders (same pipe-separated form as cart_items.variant_signature).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS variant_signature text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_variant_signature_len;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_variant_signature_len
  CHECK (char_length(variant_signature) <= 512);

CREATE INDEX IF NOT EXISTS orders_listing_variant_sig_idx
  ON public.orders (listing_id, variant_signature);

NOTIFY pgrst, 'reload schema';
