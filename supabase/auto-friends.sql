-- Run in Supabase SQL Editor

-- Auto-create accepted friendships based on mutual contact graph.
-- Called after a user uploads their contacts or sets their phone hash.
-- Matches: users who have YOUR phone hash in their contacts,
--          AND/OR users whose phone hash is in YOUR contacts.
CREATE OR REPLACE FUNCTION create_auto_friendships()
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO friendships (user_id, friend_id, status)
  SELECT auth.uid(), other_id, 'accepted'
  FROM (
    -- Users who have my phone hash saved in their contacts (they know me)
    SELECT DISTINCT ch.user_id AS other_id
    FROM contact_hashes ch
    JOIN users me ON me.id = auth.uid()
    WHERE ch.phone_hash = me.phone_hash
      AND ch.user_id != auth.uid()
      AND me.phone_hash IS NOT NULL
    UNION
    -- Users whose phone hash I have in my contacts (I know them)
    SELECT DISTINCT u.id AS other_id
    FROM contact_hashes my_ch
    JOIN users u ON u.phone_hash = my_ch.phone_hash
    WHERE my_ch.user_id = auth.uid()
      AND u.id != auth.uid()
      AND u.phone_hash IS NOT NULL
  ) candidates
  WHERE NOT EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.user_id = auth.uid() AND f.friend_id = candidates.other_id)
       OR (f.friend_id = auth.uid() AND f.user_id = candidates.other_id)
  )
  ON CONFLICT DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION create_auto_friendships() TO authenticated;


-- Updated proximity function: includes contact-graph FOF in nearby tier
-- FOF shows in nearby but is NOT auto-added to friends list
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
  mutual_count int
)
LANGUAGE sql STABLE
AS $$
  WITH
    distances AS (
      SELECT
        p.user_id,
        (3958.8 * acos(
          LEAST(1.0, cos(radians(my_lat)) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(my_lng)) +
          sin(radians(my_lat)) * sin(radians(p.lat)))
        )) AS dist_miles
      FROM presence p
      WHERE p.user_id != my_user_id
        AND p.updated_at > now() - interval '30 minutes'
    ),
    direct_friends AS (
      SELECT CASE WHEN f.user_id = my_user_id THEN f.friend_id ELSE f.user_id END AS friend_id
      FROM friendships f
      WHERE (f.user_id = my_user_id OR f.friend_id = my_user_id)
        AND f.status = 'accepted'
    ),
    -- Friendship-graph FOF
    friendship_fof AS (
      SELECT DISTINCT
        CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END AS fof_id,
        u_via.name AS via_name
      FROM direct_friends df
      JOIN friendships f2 ON (f2.user_id = df.friend_id OR f2.friend_id = df.friend_id)
        AND f2.status = 'accepted'
      JOIN users u_via ON u_via.id = df.friend_id
      WHERE
        CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END != my_user_id
        AND CASE WHEN f2.user_id = df.friend_id THEN f2.friend_id ELSE f2.user_id END
            NOT IN (SELECT friend_id FROM direct_friends)
    ),
    -- Contact-graph FOF: people in my friends' contact lists
    contact_fof AS (
      SELECT DISTINCT
        u.id AS fof_id,
        via_u.name AS via_name
      FROM direct_friends df
      JOIN contact_hashes their_ch ON their_ch.user_id = df.friend_id
      JOIN users u ON u.phone_hash = their_ch.phone_hash
      JOIN users via_u ON via_u.id = df.friend_id
      WHERE u.id != my_user_id
        AND u.id NOT IN (SELECT friend_id FROM direct_friends)
        AND u.phone_hash IS NOT NULL
    ),
    -- Merge both FOF sources
    all_fof AS (
      SELECT fof_id, via_name FROM friendship_fof
      UNION
      SELECT fof_id, via_name FROM contact_fof
    ),
    mutual_counts AS (
      SELECT
        d.user_id,
        COUNT(*)::int AS mutual_count
      FROM distances d
      JOIN friendships f3 ON (f3.user_id = d.user_id OR f3.friend_id = d.user_id)
        AND f3.status = 'accepted'
      WHERE CASE WHEN f3.user_id = d.user_id THEN f3.friend_id ELSE f3.user_id END
            IN (SELECT friend_id FROM direct_friends)
      GROUP BY d.user_id
    )
  SELECT
    d.user_id,
    u.name,
    u.avatar_color,
    d.dist_miles AS distance_miles,
    CASE
      WHEN d.user_id IN (SELECT friend_id FROM direct_friends) THEN 'friend'
      WHEN d.user_id IN (SELECT fof_id FROM all_fof) THEN 'fof'
      ELSE 'open'
    END AS tier,
    (SELECT af.via_name FROM all_fof af WHERE af.fof_id = d.user_id LIMIT 1) AS via_name,
    COALESCE((SELECT mc.mutual_count FROM mutual_counts mc WHERE mc.user_id = d.user_id), 0)
  FROM distances d
  JOIN users u ON u.id = d.user_id
  WHERE d.dist_miles < 0.35
  ORDER BY d.dist_miles ASC;
$$;
