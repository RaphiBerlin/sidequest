-- =============================================================================
-- Side/Quest — is_banned column on users
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS users_is_banned_idx ON users (is_banned) WHERE is_banned = true;
