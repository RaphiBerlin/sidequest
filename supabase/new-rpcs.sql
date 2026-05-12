-- ============================================================
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Search users by name (excludes self + existing friends)
CREATE OR REPLACE FUNCTION search_users(query text)
RETURNS TABLE(id uuid, name text, avatar_color text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.avatar_color
  FROM users u
  WHERE u.id != auth.uid()
    AND u.name ILIKE '%' || query || '%'
    AND u.id NOT IN (
      SELECT friend_id FROM friendships WHERE user_id = auth.uid()
      UNION
      SELECT user_id FROM friendships WHERE friend_id = auth.uid()
    )
  ORDER BY u.name
  LIMIT 10;
END;
$$;

-- 2. Delete account — removes auth record so the email can be re-used
CREATE OR REPLACE FUNCTION delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
