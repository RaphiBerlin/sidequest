-- Run this in the Supabase SQL Editor
CREATE OR REPLACE FUNCTION get_nearby_users(
  my_user_id uuid,
  my_lat float,
  my_lng float
)
RETURNS TABLE (
  user_id uuid,
  name text,
  avatar_color text,
  distance_miles float,
  tier text,
  via_name text,
  mutual_count int,
  lat float,
  lng float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
    -- Haversine distance calculation
    distances AS (
      SELECT
        p.user_id,
        p.lat,
        p.lng,
        (
          3958.8 * acos(
            LEAST(1.0, cos(radians(my_lat)) * cos(radians(p.lat)) *
            cos(radians(p.lng) - radians(my_lng)) +
            sin(radians(my_lat)) * sin(radians(p.lat))
          )
        ) AS dist_miles
      FROM presence p
      WHERE
        p.user_id != my_user_id
        AND p.updated_at > now() - interval '30 minutes'
    ),
    -- Direct friends
    direct_friends AS (
      SELECT
        CASE WHEN f.user_id = my_user_id THEN f.friend_id ELSE f.user_id END AS friend_id
      FROM friendships f
      WHERE (f.user_id = my_user_id OR f.friend_id = my_user_id)
        AND f.status = 'accepted'
    ),
    -- Friends of friends with via name
    fof AS (
      SELECT DISTINCT
        CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END AS fof_id,
        u_via.name AS via_name
      FROM direct_friends df
      JOIN friendships f2 ON (f2.user_id = df.friend_id OR f2.friend_id = df.friend_id)
        AND f2.status = 'accepted'
      JOIN users u_via ON u_via.id = df.friend_id
      WHERE
        CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END != my_user_id
        AND CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END NOT IN (SELECT friend_id FROM direct_friends)
    )
  SELECT
    d.user_id,
    u.name,
    u.avatar_color,
    d.dist_miles AS distance_miles,
    CASE
      WHEN d.user_id IN (SELECT friend_id FROM direct_friends) THEN 'friend'
      WHEN d.user_id IN (SELECT fof_id FROM fof) THEN 'fof'
      ELSE 'open'
    END AS tier,
    (SELECT fof.via_name FROM fof WHERE fof.fof_id = d.user_id LIMIT 1) AS via_name,
    (
      SELECT COUNT(*)::int
      FROM direct_friends df2
      WHERE df2.friend_id IN (
        SELECT CASE WHEN f3.user_id = d.user_id THEN f3.friend_id ELSE f3.user_id END
        FROM friendships f3
        WHERE (f3.user_id = d.user_id OR f3.friend_id = d.user_id)
          AND f3.status = 'accepted'
      )
    ) AS mutual_count,
    d.lat,
    d.lng
  FROM distances d
  JOIN users u ON u.id = d.user_id
  WHERE d.dist_miles < 0.35
  ORDER BY d.dist_miles ASC;
END;
$$;

-- Note: at 50-100 users this full-table scan is fine.
-- Add PostGIS extension for performance at 10K+ users.
