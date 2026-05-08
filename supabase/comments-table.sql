CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES quest_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 500),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read comments" ON comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users insert own comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS comments_session_id_idx ON comments(session_id);
