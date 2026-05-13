-- Add is_public flag to quest_sessions (default false = friends-only)
ALTER TABLE quest_sessions ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Index for fast public feed queries
CREATE INDEX IF NOT EXISTS quest_sessions_public_idx
  ON quest_sessions (completed_at DESC)
  WHERE is_public = true AND completed_at IS NOT NULL;
