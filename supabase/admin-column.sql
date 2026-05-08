-- Run in Supabase SQL Editor
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
