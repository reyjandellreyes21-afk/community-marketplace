CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT ARRAY['buyer'],
  likes INTEGER NOT NULL DEFAULT 0,
  liked_by_user_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  rating TEXT NOT NULL DEFAULT '0.0',
  distance TEXT NOT NULL DEFAULT '0.0 km',
  price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  category TEXT NOT NULL,
  is_promo BOOLEAN NOT NULL DEFAULT FALSE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_class TEXT,
  image_data_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  order_status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

