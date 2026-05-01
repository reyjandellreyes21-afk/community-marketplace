-- =============================================================================
-- LinkMart (community-marketplace) — run in Supabase Dashboard → SQL Editor
-- Creates public.listings (seller products), orders, favorites, communities, etc.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where applicable.
-- Requires: default Supabase Auth (auth.users) and public.profiles.
-- =============================================================================

-- --- Optional profile columns (ignore error if profiles table differs) ---
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_lat double precision,
  ADD COLUMN IF NOT EXISTS default_lng double precision,
  ADD COLUMN IF NOT EXISTS courier_modes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS community text;

CREATE INDEX IF NOT EXISTS profiles_community_lower_idx
  ON public.profiles ((lower(community)))
  WHERE community IS NOT NULL AND btrim(community) <> '';

-- --- Marketplace tables ---
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  vertical_id text NOT NULL DEFAULT 'COM',
  sub_id text,
  fulfillment_modes text[] NOT NULL DEFAULT ARRAY['pickup','delivery']::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'sold')),
  city_label text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  image_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_seller_idx ON public.listings (seller_id);
CREATE INDEX IF NOT EXISTS listings_vertical_sub_idx ON public.listings (vertical_id, sub_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings (status);
CREATE INDEX IF NOT EXISTS listings_geo_idx ON public.listings (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_listing_favorites (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS user_listing_favorites_user_idx ON public.user_listing_favorites (user_id);

CREATE TABLE IF NOT EXISTS public.cart_items (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE CASCADE,
  variant_signature text NOT NULL DEFAULT '' CHECK (char_length(variant_signature) <= 512),
  fulfillment_type text NOT NULL DEFAULT 'pickup' CHECK (fulfillment_type IN ('pickup', 'delivery')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id, variant_signature)
);

CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items (user_id);
CREATE INDEX IF NOT EXISTS cart_items_listing_idx ON public.cart_items (listing_id);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings (id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery')),
  status text NOT NULL DEFAULT 'placed' CHECK (
    status IN (
      'placed',
      'seller_accepted',
      'courier_assigned',
      'ready_for_pickup',
      'out_for_delivery',
      'completed',
      'cancelled'
    )
  ),
  cod_goods_cents integer NOT NULL CHECK (cod_goods_cents >= 0),
  cod_delivery_cents integer NOT NULL DEFAULT 0 CHECK (cod_delivery_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS orders_buyer_idx ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_idx ON public.orders (seller_id);
CREATE INDEX IF NOT EXISTS orders_listing_idx ON public.orders (listing_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);

CREATE TABLE IF NOT EXISTS public.courier_assignments (
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

CREATE INDEX IF NOT EXISTS courier_assignments_order_idx ON public.courier_assignments (order_id);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_courier_assignment_id uuid REFERENCES public.courier_assignments (id) ON DELETE SET NULL;

-- Milestone timestamps (same as migrations; safe for installs that only run this script).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS processing_entered_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by_role text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_receipt_acknowledged_at timestamptz;

-- Buyer note + canonical variant line (migrations 20260430121000_orders_buyer_comment +
-- 20260502120000_orders_variant_signature). Safe to re-run.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_comment text NOT NULL DEFAULT '' CHECK (char_length(buyer_comment) <= 2000);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS variant_signature text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_variant_signature_len;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_variant_signature_len
  CHECK (char_length(variant_signature) <= 512);

CREATE INDEX IF NOT EXISTS orders_listing_variant_sig_idx
  ON public.orders (listing_id, variant_signature);

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

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_listing_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listings_select_active ON public.listings;
CREATE POLICY listings_select_active ON public.listings FOR SELECT TO authenticated USING (status = 'active' OR seller_id = auth.uid());

DROP POLICY IF EXISTS listings_insert_own ON public.listings;
CREATE POLICY listings_insert_own ON public.listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS listings_update_own ON public.listings;
CREATE POLICY listings_update_own ON public.listings FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS listings_delete_own ON public.listings;
CREATE POLICY listings_delete_own ON public.listings FOR DELETE TO authenticated USING (seller_id = auth.uid());

DROP POLICY IF EXISTS favorites_all_own ON public.user_listing_favorites;
CREATE POLICY favorites_all_own ON public.user_listing_favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cart_items_all_own ON public.cart_items;
CREATE POLICY cart_items_all_own ON public.cart_items FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS orders_select_parties ON public.orders;
CREATE POLICY orders_select_parties ON public.orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS orders_insert_buyer ON public.orders;
CREATE POLICY orders_insert_buyer ON public.orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS orders_update_parties ON public.orders;
CREATE POLICY orders_update_parties ON public.orders FOR UPDATE TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS courier_assignments_select_related ON public.courier_assignments;
CREATE POLICY courier_assignments_select_related ON public.courier_assignments FOR SELECT TO authenticated USING (
  courier_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS courier_assignments_insert_own ON public.courier_assignments;
CREATE POLICY courier_assignments_insert_own ON public.courier_assignments FOR INSERT TO authenticated WITH CHECK (courier_id = auth.uid());

DROP POLICY IF EXISTS courier_assignments_update_own ON public.courier_assignments;
CREATE POLICY courier_assignments_update_own ON public.courier_assignments FOR UPDATE TO authenticated USING (courier_id = auth.uid());

DROP POLICY IF EXISTS expenses_own ON public.seller_expenses;
CREATE POLICY expenses_own ON public.seller_expenses FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- --- Communities ---
CREATE TABLE IF NOT EXISTS public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) >= 2),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 500),
  google_url text NOT NULL DEFAULT '' CHECK (char_length(google_url) <= 2048),
  image_url text NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 2048),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communities_created_at_idx ON public.communities (created_at DESC);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communities_select_all ON public.communities;
CREATE POLICY communities_select_all ON public.communities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS communities_insert_own ON public.communities;
CREATE POLICY communities_insert_own ON public.communities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

GRANT SELECT, INSERT ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 120);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT '' CHECK (char_length(province) <= 120);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code) <= 32);

-- --- Listings → community (optional FK) ---
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listings_community_idx ON public.listings (community_id) WHERE community_id IS NOT NULL;

-- --- Storage: public bucket for community cover images ---
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-images',
  'community-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "community_images_public_read" ON storage.objects;
CREATE POLICY "community_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-images');

-- --- Refresh API schema cache ---
NOTIFY pgrst, 'reload schema';
