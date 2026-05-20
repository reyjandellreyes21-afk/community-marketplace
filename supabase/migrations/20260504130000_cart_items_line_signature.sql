-- Separate cart rows when variant + fulfillment + buyer note differ (SHA-256 line identity).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS line_signature text NOT NULL DEFAULT '';

UPDATE public.cart_items
SET
  line_signature = encode(
    digest(
      convert_to(
        substring(trim(variant_signature) FROM 1 FOR 512)
          || E'\n'
          || lower(trim(coalesce(fulfillment_type::text, '')))
          || E'\n'
          || substring(trim(coalesce(comment, '')) FROM 1 FOR 2000),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_pkey;

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_line_signature_hex;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_line_signature_hex CHECK (
    char_length(line_signature) = 64
    AND line_signature ~ '^[a-f0-9]{64}$'
  );

ALTER TABLE public.cart_items ADD PRIMARY KEY (user_id, listing_id, line_signature);

COMMENT ON COLUMN public.cart_items.line_signature IS
  'SHA-256 (hex, 64 chars) of variant_signature + fulfillment + buyer comment; distinguishes cart lines for the same listing.';

NOTIFY pgrst, 'reload schema';
