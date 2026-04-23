INSERT INTO users (id, name, email, password_hash, roles, likes, liked_by_user_ids)
VALUES
  (
    'u-seed',
    'Demo Seller',
    'seller@cpr.local',
    '$2b$10$6N20E5jiVhoom9ioTW8w5uNymjmVnqYjPAlyYQv7PoYxUfy4Nwcxu',
    ARRAY['buyer', 'seller'],
    0,
    ARRAY[]::TEXT[]
  )
ON CONFLICT (id) DO NOTHING;

