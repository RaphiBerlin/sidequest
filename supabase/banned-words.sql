-- =============================================================================
-- Side/Quest — banned_words table
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS banned_words (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT banned_words_word_unique UNIQUE (word)
);

ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for client-side validation)
CREATE POLICY "banned_words: authenticated read"
  ON banned_words FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert / delete
CREATE POLICY "banned_words: admin write"
  ON banned_words FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND (users.is_admin = true OR users.email = current_setting('app.settings.admin_email', true))
    )
  );

CREATE INDEX IF NOT EXISTS banned_words_word_idx ON banned_words (lower(word));
