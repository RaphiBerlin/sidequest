-- =============================================================================
-- Side/Quest — push_logs table
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text,
  total       int  DEFAULT 0,   -- subscriptions attempted
  sent        int  DEFAULT 0,   -- successful deliveries
  failed      int  DEFAULT 0,   -- failed deliveries
  triggered_by text,            -- 'quest_drop' | 'manual' | 'cron'
  created_at  timestamptz DEFAULT now()
);

-- Only service role writes; admins read via service role key in edge functions
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_logs: service role only"
  ON push_logs FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS push_logs_created_at_idx ON push_logs (created_at DESC);
