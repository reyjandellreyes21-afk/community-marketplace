-- Idempotent repair if `cart_items.fulfillment_type` was never applied (fixes PostgREST schema cache / add-to-cart).

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'pickup'
  CHECK (fulfillment_type IN ('pickup', 'delivery'));

COMMENT ON COLUMN public.cart_items.fulfillment_type IS
  'Buyer choice for COD pickup vs delivery; must be allowed by listings.fulfillment_modes.';

NOTIFY pgrst, 'reload schema';
