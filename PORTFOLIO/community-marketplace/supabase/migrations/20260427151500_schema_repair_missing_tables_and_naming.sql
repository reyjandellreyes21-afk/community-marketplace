-- Repair migration for installs with partial/legacy marketplace schema.
-- Goals:
-- 1) Ensure table names expected by API exist (`listings`, `communities`).
-- 2) Ensure missing feature tables exist (`delivery_bids`, `seller_expenses`, `order_reviews`, `user_order_attention`).
-- 3) Keep migration safe to re-run.

-- -----------------------------------------------------------------------------
-- 1) Naming mismatch repair: communities_listings -> listings
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.communities_listings') IS NOT NULL
     AND to_regclass('public.listings') IS NULL THEN
    EXECUTE 'ALTER TABLE public.communities_listings RENAME TO listings';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Core marketplace tables expected by API
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  google_url text NOT NULL DEFAULT '' CHECK (char_length(google_url) <= 2048),
  image_url text NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 2048),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 120),
  province text NOT NULL DEFAULT '' CHECK (char_length(province) <= 120),
  postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code) <= 32)
);

CREATE INDEX IF NOT EXISTS communities_created_at_idx ON public.communities (created_at DESC);

-- If listings already exists (including renamed legacy table), align required columns.
DO $$
BEGIN
  IF to_regclass('public.listings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users (id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS title text';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''''';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price_cents integer CHECK (price_cents >= 0)';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0)';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS vertical_id text NOT NULL DEFAULT ''COM''';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS sub_id text';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS fulfillment_modes text[] NOT NULL DEFAULT ARRAY[''pickup'',''delivery'']::text[]';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT ''active''';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS city_label text NOT NULL DEFAULT ''''';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lat double precision';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lng double precision';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT ''''';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities (id) ON DELETE SET NULL';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()';
    EXECUTE 'ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_seller_idx ON public.listings (seller_id);
CREATE INDEX IF NOT EXISTS listings_vertical_sub_idx ON public.listings (vertical_id, sub_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings (status);
CREATE INDEX IF NOT EXISTS listings_geo_idx ON public.listings (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS listings_community_idx ON public.listings (community_id) WHERE community_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) Missing feature tables used by API endpoints
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  eta_minutes integer,
  mode text NOT NULL CHECK (mode IN ('walk', 'run', 'bike')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, courier_id)
);

CREATE INDEX IF NOT EXISTS delivery_bids_order_idx ON public.delivery_bids (order_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_bid_id uuid REFERENCES public.delivery_bids (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.seller_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  note text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT (CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_expenses_seller_idx ON public.seller_expenses (seller_id);

CREATE TABLE IF NOT EXISTS public.order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders (id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS order_reviews_seller_idx ON public.order_reviews (seller_id);
CREATE INDEX IF NOT EXISTS order_reviews_listing_idx ON public.order_reviews (listing_id);

CREATE TABLE IF NOT EXISTS public.user_order_attention (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  buyer_attention jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_attention jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_order_attention_updated_idx ON public.user_order_attention (updated_at DESC);

-- -----------------------------------------------------------------------------
-- 4) RLS + policies for newly repaired tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_order_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communities_select_all ON public.communities;
CREATE POLICY communities_select_all ON public.communities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS communities_insert_own ON public.communities;
CREATE POLICY communities_insert_own ON public.communities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS listings_select_active ON public.listings;
CREATE POLICY listings_select_active ON public.listings FOR SELECT TO authenticated USING (status = 'active' OR seller_id = auth.uid());

DROP POLICY IF EXISTS listings_insert_own ON public.listings;
CREATE POLICY listings_insert_own ON public.listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS listings_update_own ON public.listings;
CREATE POLICY listings_update_own ON public.listings FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS listings_delete_own ON public.listings;
CREATE POLICY listings_delete_own ON public.listings FOR DELETE TO authenticated USING (seller_id = auth.uid());

DROP POLICY IF EXISTS bids_select_related ON public.delivery_bids;
CREATE POLICY bids_select_related ON public.delivery_bids FOR SELECT TO authenticated USING (
  courier_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS bids_insert_courier ON public.delivery_bids;
CREATE POLICY bids_insert_courier ON public.delivery_bids FOR INSERT TO authenticated WITH CHECK (courier_id = auth.uid());

DROP POLICY IF EXISTS bids_update_courier ON public.delivery_bids;
CREATE POLICY bids_update_courier ON public.delivery_bids FOR UPDATE TO authenticated USING (courier_id = auth.uid());

DROP POLICY IF EXISTS expenses_own ON public.seller_expenses;
CREATE POLICY expenses_own ON public.seller_expenses FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS order_reviews_select_parties ON public.order_reviews;
CREATE POLICY order_reviews_select_parties ON public.order_reviews FOR SELECT TO authenticated USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

DROP POLICY IF EXISTS order_reviews_insert_buyer ON public.order_reviews;
CREATE POLICY order_reviews_insert_buyer ON public.order_reviews FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS order_reviews_update_buyer ON public.order_reviews;
CREATE POLICY order_reviews_update_buyer ON public.order_reviews FOR UPDATE TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_select_own ON public.user_order_attention;
CREATE POLICY user_order_attention_select_own ON public.user_order_attention FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_insert_own ON public.user_order_attention;
CREATE POLICY user_order_attention_insert_own ON public.user_order_attention FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_update_own ON public.user_order_attention;
CREATE POLICY user_order_attention_update_own ON public.user_order_attention FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_order_attention_delete_own ON public.user_order_attention;
CREATE POLICY user_order_attention_delete_own ON public.user_order_attention FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
