-- Add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow users to update their own avatar_url
-- (Existing update policy should cover this — no new policy needed)
