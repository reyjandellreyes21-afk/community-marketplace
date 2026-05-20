-- One buyer→courier rating per lifetime pair (any order). Keeps review tied to first assignment submitted.

DELETE FROM public.courier_delivery_reviews
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY buyer_id, courier_id
             ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
    FROM public.courier_delivery_reviews
  ) d
  WHERE d.rn > 1
);

ALTER TABLE public.courier_delivery_reviews
  DROP CONSTRAINT IF EXISTS courier_delivery_reviews_one_buyer_courier;

ALTER TABLE public.courier_delivery_reviews
  ADD CONSTRAINT courier_delivery_reviews_one_buyer_courier UNIQUE (buyer_id, courier_id);

COMMENT ON CONSTRAINT courier_delivery_reviews_one_buyer_courier ON public.courier_delivery_reviews IS
  'Buyer may submit at most one courier rating per courier; stored on the order they rate.';
