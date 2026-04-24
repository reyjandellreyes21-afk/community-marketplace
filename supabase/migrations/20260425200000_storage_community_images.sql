-- Public bucket for community cover photos (server uploads via service role).
-- The API also calls storage.createBucket on first upload if the bucket is missing;
-- keep this migration so limits, MIME rules, and the public SELECT policy stay in sync.

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

-- Anyone can read objects in this bucket (public listing images).
DROP POLICY IF EXISTS "community_images_public_read" ON storage.objects;
CREATE POLICY "community_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-images');
