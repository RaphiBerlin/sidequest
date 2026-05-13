-- =============================================================================
-- Side/Quest — Allow reading friends' completed quest sessions
-- Run in Supabase SQL Editor
-- =============================================================================
-- The existing policy only allows seeing your own sessions or ones where you
-- are in party_ids. This adds a policy for the Feed: see any completed session
-- from a user you have an accepted friendship with.

CREATE POLICY "quest_sessions: can see accepted friends sessions"
  ON quest_sessions
  FOR SELECT
  TO authenticated
  USING (
    completed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND (
          (friendships.user_id   = auth.uid() AND friendships.friend_id = quest_sessions.user_id)
          OR
          (friendships.friend_id = auth.uid() AND friendships.user_id   = quest_sessions.user_id)
        )
    )
  );
