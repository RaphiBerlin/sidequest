-- =============================================================================
-- Side/Quest — quest-photos Storage Bucket + Policies
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================================

-- Create the bucket if it doesn't exist.
-- public = true so getPublicUrl() works without signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quest-photos',
  'quest-photos',
  true,
  10485760,   -- 10 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- ── RLS Policies ─────────────────────────────────────────────────────────────

-- Public read (bucket is public, but explicit policy is best practice)
CREATE POLICY "quest-photos: public can read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'quest-photos');

-- Authenticated users can upload to their own folder: {userId}/{sessionId}-{type}.jpg
CREATE POLICY "quest-photos: authenticated can upload own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'quest-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow upsert (same path = overwrite) — needed by upsert: true in uploadPhoto
CREATE POLICY "quest-photos: authenticated can update own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'quest-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'quest-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own photos
CREATE POLICY "quest-photos: authenticated can delete own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'quest-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
