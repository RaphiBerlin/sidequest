-- Quest scheduling table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS quest_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid REFERENCES quests(id) ON DELETE SET NULL,  -- null = random quest
  scheduled_at timestamptz NOT NULL,
  label text,            -- optional human note e.g. "Monday evening drop"
  executed boolean DEFAULT false,
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quest_schedule ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the schedule
CREATE POLICY "quest_schedule: authenticated select"
  ON quest_schedule FOR SELECT TO authenticated USING (true);

-- Only service role can insert/update/delete (done via Edge Function)
-- Admins call drop-quest which handles inserts; reads are via the admin panel

CREATE INDEX IF NOT EXISTS quest_schedule_scheduled_at_idx
  ON quest_schedule (scheduled_at)
  WHERE executed = false;
