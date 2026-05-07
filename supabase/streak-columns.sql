-- Run in Supabase SQL Editor
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak int DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_quest_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_freeze_used_at timestamptz;
