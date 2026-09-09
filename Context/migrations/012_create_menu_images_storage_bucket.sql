-- ==============================================================================
-- Migration 012: Create Public Storage Bucket for Menu Items
--
-- Purpose:
-- Transitions menu item image storage from PostgreSQL Base64 text columns to
-- Supabase Object Storage (S3 / CDN). This dramatically reduces database payload
-- size, cuts network egress by over 99%, and enables browser-level CDN caching.
--
-- Instructions:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Run this script to create the 'menu-items' public bucket and policies.
-- ==============================================================================

-- 1. Create the bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-items',
  'menu-items',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Allow public read access to all files in 'menu-items'
DROP POLICY IF EXISTS "Public Access menu-items" ON storage.objects;
CREATE POLICY "Public Access menu-items"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-items');

-- 3. Allow anonymous & authenticated uploads into 'menu-items'
DROP POLICY IF EXISTS "Allow Upload menu-items" ON storage.objects;
CREATE POLICY "Allow Upload menu-items"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-items');

-- 4. Allow anonymous & authenticated updates into 'menu-items'
DROP POLICY IF EXISTS "Allow Update menu-items" ON storage.objects;
CREATE POLICY "Allow Update menu-items"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-items');

-- 5. Allow deletion of objects in 'menu-items'
DROP POLICY IF EXISTS "Allow Delete menu-items" ON storage.objects;
CREATE POLICY "Allow Delete menu-items"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-items');
