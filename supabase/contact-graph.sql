-- Run in Supabase SQL Editor

-- Store user's own phone hash (so others can find them via contacts)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash text;
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash) WHERE phone_hash IS NOT NULL;

-- Store hashed phone numbers from each user's contacts
CREATE TABLE IF NOT EXISTS contact_hashes (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  PRIMARY KEY (user_id, phone_hash)
);
CREATE INDEX IF NOT EXISTS idx_contact_hashes_phone_hash ON contact_hashes(phone_hash);

ALTER TABLE contact_hashes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contact hashes" ON contact_hashes
  FOR ALL USING (auth.uid() = user_id);

-- Upsert contact hashes for current user (called from onboarding / friends page)
CREATE OR REPLACE FUNCTION store_contact_hashes(hashes text[])
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM contact_hashes WHERE user_id = auth.uid();
  INSERT INTO contact_hashes (user_id, phone_hash)
  SELECT auth.uid(), unnest(hashes)
  ON CONFLICT DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION store_contact_hashes(text[]) TO authenticated;

-- Returns friend suggestions: direct contacts on app + friends of friends
-- connection_type: 'contact' | 'fof'
-- via_name: name of the mutual contact (for fof)
CREATE OR REPLACE FUNCTION get_contact_suggestions()
RETURNS TABLE (
  user_id uuid,
  name text,
  avatar_color text,
  connection_type text,
  via_name text,
  already_friends bool
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH
    -- Users already friended
    my_friends AS (
      SELECT CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS friend_id
      FROM friendships f
      WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
        AND f.status IN ('accepted', 'pending')
    ),
    -- Direct: users whose phone_hash appears in my contact_hashes
    direct AS (
      SELECT DISTINCT u.id, u.name, u.avatar_color
      FROM users u
      JOIN contact_hashes ch ON ch.phone_hash = u.phone_hash
      WHERE ch.user_id = auth.uid()
        AND u.id != auth.uid()
        AND u.phone_hash IS NOT NULL
    ),
    -- FOF: users in my contacts' contact lists who are on the app
    fof AS (
      SELECT DISTINCT
        u.id,
        u.name,
        u.avatar_color,
        d.name AS via
      FROM direct d
      JOIN contact_hashes their_ch ON their_ch.user_id = d.id
      JOIN users u ON u.phone_hash = their_ch.phone_hash
      WHERE u.id != auth.uid()
        AND u.id NOT IN (SELECT id FROM direct)
        AND u.phone_hash IS NOT NULL
    )
  SELECT
    d.id,
    d.name,
    d.avatar_color,
    'contact'::text,
    NULL::text,
    EXISTS (SELECT 1 FROM my_friends mf WHERE mf.friend_id = d.id)
  FROM direct d
  UNION ALL
  SELECT
    f.id,
    f.name,
    f.avatar_color,
    'fof'::text,
    f.via,
    EXISTS (SELECT 1 FROM my_friends mf WHERE mf.friend_id = f.id)
  FROM fof f;
$$;
GRANT EXECUTE ON FUNCTION get_contact_suggestions() TO authenticated;
