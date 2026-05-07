-- =============================================================================
-- Side/Quest — Row Level Security Policies
-- Run this entire script in the Supabase SQL Editor after the schema migration
-- from Task 1
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_quest   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests         ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- Any authenticated user can read the users table (needed for profile lookups,
-- friend lists, etc.)
CREATE POLICY "users: authenticated can select"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- A user can only update their own row
CREATE POLICY "users: owner can update"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

-- A user can see any friendship row they are a party to
CREATE POLICY "friendships: authenticated can select own"
  ON friendships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- A user can only insert friendship rows they initiated
CREATE POLICY "friendships: authenticated can insert own"
  ON friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Either party in a friendship can update it (e.g. accepting a request)
CREATE POLICY "friendships: parties can update"
  ON friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Either party can delete the friendship row (unfriend / reject)
CREATE POLICY "friendships: parties can delete"
  ON friendships
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);


-- ---------------------------------------------------------------------------
-- quest_sessions
-- ---------------------------------------------------------------------------

-- A user can see their own sessions OR any session they are part of as a
-- party member
CREATE POLICY "quest_sessions: authenticated can select own or party"
  ON quest_sessions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = ANY(party_ids)
  );

-- A user can only create sessions for themselves
CREATE POLICY "quest_sessions: authenticated can insert own"
  ON quest_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can only update their own sessions (e.g. uploading a photo,
-- completing the quest)
CREATE POLICY "quest_sessions: owner can update"
  ON quest_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------

-- All authenticated users can see all reactions
CREATE POLICY "reactions: authenticated can select all"
  ON reactions
  FOR SELECT
  TO authenticated
  USING (true);

-- A user can only create reactions attributed to themselves
CREATE POLICY "reactions: authenticated can insert own"
  ON reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can only delete their own reactions
CREATE POLICY "reactions: owner can delete"
  ON reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- presence
-- ---------------------------------------------------------------------------

-- All authenticated users can see presence data (needed for the nearby screen)
CREATE POLICY "presence: authenticated can select all"
  ON presence
  FOR SELECT
  TO authenticated
  USING (true);

-- A user can insert their own presence row
CREATE POLICY "presence: authenticated can insert own"
  ON presence
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user can update their own presence row (location updates)
CREATE POLICY "presence: owner can update"
  ON presence
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- A user can delete their own presence row (going offline)
CREATE POLICY "presence: owner can delete"
  ON presence
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- active_quest
-- (writes are handled exclusively by the Edge Function via service role;
--  regular authenticated users only read)
-- ---------------------------------------------------------------------------

-- All authenticated users can see the currently active quest
CREATE POLICY "active_quest: authenticated can select all"
  ON active_quest
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE policies for authenticated role.
-- The Edge Function (drop-quest) runs as service_role which bypasses RLS,
-- so no additional policies are needed for writes.


-- ---------------------------------------------------------------------------
-- quests (the quest pool)
-- (read-only for users; seeding / editing is done via service role or
--  the Supabase dashboard)
-- ---------------------------------------------------------------------------

-- All authenticated users can read the quest pool
CREATE POLICY "quests: authenticated can select all"
  ON quests
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE policies for authenticated role.
-- Quest pool management is done via service_role (migrations / admin).
