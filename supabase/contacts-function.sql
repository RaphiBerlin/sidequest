-- Run in Supabase SQL Editor

-- Make email nullable (switching to SMS auth)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Find users by hashed phone numbers (privacy-preserving contact matching)
-- Client hashes contact phone numbers with SHA-256 before sending
-- Server hashes auth.users.phone and compares — raw numbers never leave the device
CREATE OR REPLACE FUNCTION find_users_by_phone_hashes(phone_hashes text[])
RETURNS TABLE (user_id uuid, name text, avatar_color text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    u.id AS user_id,
    u.name,
    u.avatar_color
  FROM auth.users au
  JOIN public.users u ON u.id = au.id
  WHERE encode(sha256(au.phone::bytea), 'hex') = ANY(phone_hashes)
    AND au.phone IS NOT NULL
    AND au.id != auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION find_users_by_phone_hashes(text[]) TO authenticated;
