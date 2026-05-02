-- Phase 2: split buyer/seller contributions to courier (COD handoff, no wallet).
-- cod_delivery_cents remains the total pool = buyer + seller (server-maintained).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_courier_contribution_cents integer NOT NULL DEFAULT 0
    CHECK (buyer_courier_contribution_cents >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS seller_courier_contribution_cents integer NOT NULL DEFAULT 0
    CHECK (seller_courier_contribution_cents >= 0);

-- Existing rows: treat prior cod_delivery_cents as buyer-only so totals stay consistent.
UPDATE public.orders
SET
  buyer_courier_contribution_cents = GREATEST(0, COALESCE(cod_delivery_cents, 0)),
  seller_courier_contribution_cents = 0
WHERE buyer_courier_contribution_cents = 0
  AND seller_courier_contribution_cents = 0
  AND COALESCE(cod_delivery_cents, 0) > 0;

COMMENT ON COLUMN public.orders.buyer_courier_contribution_cents IS 'Buyer share of courier COD pool (centavos PHP).';
COMMENT ON COLUMN public.orders.seller_courier_contribution_cents IS 'Seller share of courier COD pool (centavos PHP).';

-- Optional: courier suggested compensation (display only, never auto-charged).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS courier_suggested_cents integer
    CHECK (courier_suggested_cents IS NULL OR courier_suggested_cents >= 0);

COMMENT ON COLUMN public.profiles.courier_suggested_cents IS 'Optional suggested courier compensation (centavos); informational only.';
