-- Streak increment function
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION increment_streak(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_at timestamptz;
  days_since int;
BEGIN
  SELECT last_quest_at INTO last_at FROM users WHERE id = uid;

  IF last_at IS NULL THEN
    -- First ever quest
    UPDATE users SET streak = 1, last_quest_at = now() WHERE id = uid;
  ELSE
    days_since := EXTRACT(DAY FROM (now() - last_at))::int;

    IF days_since = 0 THEN
      -- Already completed a quest today — update timestamp but don't double-count
      UPDATE users SET last_quest_at = now() WHERE id = uid;
    ELSIF days_since = 1 THEN
      -- Completed yesterday, extend streak
      UPDATE users SET streak = streak + 1, last_quest_at = now() WHERE id = uid;
    ELSE
      -- Missed at least one day, reset streak
      UPDATE users SET streak = 1, last_quest_at = now() WHERE id = uid;
    END IF;
  END IF;
END;
$$;

-- Add last_quest_at column if it doesn't exist yet
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_quest_at timestamptz;
