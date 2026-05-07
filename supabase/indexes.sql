-- Performance indexes for Side/Quest
-- Run in Supabase SQL Editor (safe to run even if indexes already exist)

CREATE INDEX IF NOT EXISTS idx_quest_sessions_user_id ON quest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_completed_at ON quest_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_party_ids ON quest_sessions USING GIN(party_ids);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_presence_updated_at ON presence(updated_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_reactions_session_id ON reactions(session_id);
