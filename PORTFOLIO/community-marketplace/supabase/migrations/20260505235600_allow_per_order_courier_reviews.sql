-- Allow buyers to rate the same courier on multiple completed orders.
-- Keep one review per accepted courier assignment (order-level uniqueness).

ALTER TABLE public.courier_delivery_reviews
  DROP CONSTRAINT IF EXISTS courier_delivery_reviews_one_buyer_courier;
