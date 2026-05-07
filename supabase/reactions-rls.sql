-- Reactions RLS policies
-- Run in Supabase SQL Editor after enabling RLS on reactions table

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reactions"
  ON reactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own reactions"
  ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON reactions FOR DELETE
  USING (auth.uid() = user_id);
