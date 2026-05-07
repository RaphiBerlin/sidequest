ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 9);
