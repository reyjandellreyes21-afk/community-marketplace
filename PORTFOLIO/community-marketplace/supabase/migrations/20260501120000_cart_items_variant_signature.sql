-- Allow multiple cart rows per listing when variant selections differ.

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_pkey;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_signature text NOT NULL DEFAULT '';

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_variant_signature_len;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_variant_signature_len CHECK (char_length(variant_signature) <= 512);

ALTER TABLE public.cart_items
  ADD PRIMARY KEY (user_id, listing_id, variant_signature);

NOTIFY pgrst, 'reload schema';
