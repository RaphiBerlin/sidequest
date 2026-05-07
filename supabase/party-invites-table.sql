CREATE TABLE IF NOT EXISTS party_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES quest_sessions(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '5 minutes'
);

ALTER TABLE party_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invites"
  ON party_invites FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can insert invites"
  ON party_invites FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
