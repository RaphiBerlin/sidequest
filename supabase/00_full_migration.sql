-- =============================================================================
-- Side/Quest — Full Database Migration
-- Run this entire script once in the Supabase SQL Editor
-- Order matters: tables → columns → functions → RLS → seed data → realtime
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1: Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  avatar_color text DEFAULT '#c44829',
  streak int DEFAULT 0,
  last_quest_date date,
  last_freeze_used_at timestamptz,
  invite_code text UNIQUE DEFAULT substr(md5(random()::text), 0, 9),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  friend_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  tier text DEFAULT 'friend',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_min int DEFAULT 45,
  xp int DEFAULT 100,
  context_tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS active_quest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid REFERENCES quests(id),
  dropped_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '45 minutes'
);

CREATE TABLE IF NOT EXISTS quest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid REFERENCES quests(id),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  party_ids uuid[] DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  photo_url text,
  pip_photo_url text,
  elapsed_sec int,
  xp_earned int DEFAULT 0,
  party_status jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES quest_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS presence (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat float NOT NULL,
  lng float NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  event text NOT NULL,
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- STEP 2: Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_quest_sessions_user_id ON quest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_sessions_completed_at ON quest_sessions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_presence_updated_at ON presence(updated_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);


-- ---------------------------------------------------------------------------
-- STEP 3: Proximity function (Haversine)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_nearby_users(
  my_user_id uuid,
  my_lat float,
  my_lng float
)
RETURNS TABLE (
  user_id uuid,
  name text,
  avatar_color text,
  distance_miles float,
  tier text,
  via_name text,
  mutual_count int
)
LANGUAGE sql
STABLE
AS $$
  WITH distances AS (
    SELECT
      p.user_id,
      3958.8 * acos(
        LEAST(1.0,
          cos(radians(my_lat)) * cos(radians(p.lat))
          * cos(radians(p.lng) - radians(my_lng))
          + sin(radians(my_lat)) * sin(radians(p.lat))
        )
      ) AS dist_miles
    FROM presence p
    WHERE p.user_id <> my_user_id
      AND p.updated_at > now() - interval '30 minutes'
  ),
  my_friends AS (
    SELECT
      CASE WHEN f.user_id = my_user_id THEN f.friend_id ELSE f.user_id END AS friend_id
    FROM friendships f
    WHERE (f.user_id = my_user_id OR f.friend_id = my_user_id)
      AND f.status = 'accepted'
  ),
  fof_list AS (
    SELECT DISTINCT
      CASE WHEN f2.user_id = mf.friend_id THEN f2.friend_id ELSE f2.user_id END AS fof_id,
      u_via.name AS via_name
    FROM my_friends mf
    JOIN friendships f2
      ON (f2.user_id = mf.friend_id OR f2.friend_id = mf.friend_id)
      AND f2.status = 'accepted'
    JOIN users u_via ON u_via.id = mf.friend_id
    WHERE
      CASE WHEN f2.user_id = mf.friend_id THEN f2.friend_id ELSE f2.user_id END <> my_user_id
      AND CASE WHEN f2.user_id = mf.friend_id THEN f2.friend_id ELSE f2.user_id END
          NOT IN (SELECT friend_id FROM my_friends)
  ),
  their_friends AS (
    SELECT
      CASE WHEN f3.user_id = d.user_id THEN f3.friend_id ELSE f3.user_id END AS shared_friend,
      d.user_id AS nearby_user_id
    FROM distances d
    JOIN friendships f3
      ON (f3.user_id = d.user_id OR f3.friend_id = d.user_id)
      AND f3.status = 'accepted'
  ),
  mutual_counts AS (
    SELECT tf.nearby_user_id, COUNT(*) AS cnt
    FROM their_friends tf
    JOIN my_friends mf ON mf.friend_id = tf.shared_friend
    GROUP BY tf.nearby_user_id
  )
  SELECT
    d.user_id,
    u.name,
    u.avatar_color,
    d.dist_miles AS distance_miles,
    CASE
      WHEN d.user_id IN (SELECT friend_id FROM my_friends) THEN 'friend'
      WHEN d.user_id IN (SELECT fof_id FROM fof_list) THEN 'fof'
      ELSE 'open'
    END AS tier,
    (SELECT fl.via_name FROM fof_list fl WHERE fl.fof_id = d.user_id LIMIT 1) AS via_name,
    COALESCE((SELECT mc.cnt::int FROM mutual_counts mc WHERE mc.nearby_user_id = d.user_id), 0) AS mutual_count
  FROM distances d
  JOIN users u ON u.id = d.user_id
  WHERE d.dist_miles < 0.35
  ORDER BY d.dist_miles ASC;
$$;


-- ---------------------------------------------------------------------------
-- STEP 4: Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence          ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_quest      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events  ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users: authenticated can select"
  ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users: owner can update"
  ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users: owner can insert"
  ON users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- friendships
CREATE POLICY "friendships: parties can select"
  ON friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friendships: authenticated can insert own"
  ON friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "friendships: parties can update"
  ON friendships FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friendships: parties can delete"
  ON friendships FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- quest_sessions
CREATE POLICY "quest_sessions: select own or party"
  ON quest_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = ANY(party_ids));
CREATE POLICY "quest_sessions: insert own"
  ON quest_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quest_sessions: owner can update"
  ON quest_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- reactions
CREATE POLICY "reactions: authenticated can select"
  ON reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions: insert own"
  ON reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions: delete own"
  ON reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- presence
CREATE POLICY "presence: authenticated can select"
  ON presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence: insert own"
  ON presence FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence: owner can update"
  ON presence FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence: owner can delete"
  ON presence FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- active_quest (write only via service role / Edge Function)
CREATE POLICY "active_quest: authenticated can select"
  ON active_quest FOR SELECT TO authenticated USING (true);

-- quests (read-only for users)
CREATE POLICY "quests: authenticated can select"
  ON quests FOR SELECT TO authenticated USING (true);

-- analytics_events
CREATE POLICY "analytics: users insert own"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- STEP 5: Enable Realtime on active_quest
-- ---------------------------------------------------------------------------

ALTER TABLE active_quest REPLICA IDENTITY FULL;
-- After running this script, go to:
-- Supabase Dashboard → Database → Replication → enable active_quest table


-- ---------------------------------------------------------------------------
-- STEP 6: Quest seed data (25 quests)
-- ---------------------------------------------------------------------------

INSERT INTO quests (title, description, duration_min, xp, context_tags) VALUES
('The Human Sundial', 'Find a tall structure casting a sharp shadow on flat ground — a lamppost, monument, or building corner. Place a small object (a coin, your shoe) at the exact tip of the shadow and note the time. Return in 10 minutes and photograph both the original marker and the new shadow tip in the same frame. Proof of the sun moving counts as proof of patience.', 45, 100, ARRAY['universal', 'outdoor']),
('Overheard', 'Sit in a public place — a café, park, or plaza — for 10 minutes and listen. Write down (or voice-memo) the most interesting sentence you overhear verbatim. Photograph the location. No context needed. Just the sentence, exactly as said.', 30, 80, ARRAY['universal', 'urban', 'social']),
('Local Legend', 'Find something in your immediate area that has a plaque, historical marker, or informational sign. Photograph yourself reading it. If you can find a local who can tell you something about the location that isn''t on the sign — even better. Capture that too.', 45, 120, ARRAY['universal', 'urban', 'suburban']),
('Texture Collection', 'Find and photograph 5 dramatically different textures within a 0.2-mile radius: rough, smooth, soft, hard, and one you can''t name. Each photo must show your finger touching the surface for scale. Compile into a grid in your camera roll.', 30, 90, ARRAY['universal', 'outdoor', 'nature']),
('The Colour of Now', 'Identify the single most dominant colour in your current environment — not on your phone, in the physical space around you. Find three separate objects of that exact shade and photograph them together in one frame. Colour-matching is the challenge.', 25, 80, ARRAY['universal', 'urban', 'suburban', 'indoor']),
('Still Life, Still Moving', 'Find a spot where something is always in motion — traffic, water, crowds, wind in trees. Set your phone on something stable and take the longest-exposure-equivalent burst you can. Photograph 20 frames of the same composition. Pick the one where the motion blur tells the best story.', 40, 110, ARRAY['universal', 'urban', 'water', 'park']),
('The Generous Stranger', 'Give something away to a stranger — a compliment, a piece of gum, directions they didn''t ask for, or help with something you notice they need. Document the exchange however feels right: a photo of their reaction (with permission), a voice note immediately after, or a selfie at the location. The gift must be genuine.', 35, 130, ARRAY['universal', 'urban', 'social']),
('Mirror City', 'Find a reflective surface that shows your city back at you in a distorted or unexpected way: a puddle, a curved shop window, a car door, a spoon held up at arm''s length. Photograph the reflection so it''s the main subject — your city, reimagined in a curved mirror.', 30, 95, ARRAY['universal', 'urban']),
('The Rule of Three', 'Three of anything that doesn''t usually come in threes. Three of the same person (candid, different distances), three identical objects in unexpected places, three matching colours on unrelated things. The trio must be in one frame.', 35, 85, ARRAY['universal', 'outdoor']),
('Parallel Lines', 'Architecture quest: find a spot where at least four parallel lines converge toward a vanishing point. Roads, railings, staircases, buildings, fence posts. Lie down, crouch, or climb something to get the most dramatic perspective. The lines must actually converge in frame — not just be parallel.', 40, 105, ARRAY['universal', 'urban', 'architecture']),
('The Quiet Bench', 'Find a bench that no one is sitting on. Sit on it for 5 full minutes without looking at your phone. Then photograph what you were looking at the whole time. The photo must be taken from the bench, at sitting height, exactly where your eyes were resting.', 20, 70, ARRAY['universal', 'park', 'suburban', 'urban']),
('Countdown', 'Find something that counts: a timer, a clock, a sports scoreboard, a queue ticket number, a flight departure board. Photograph the number. Then return and photograph it again when it has changed. Two photos, same framing, different number. Time captured.', 40, 95, ARRAY['universal', 'urban', 'commercial']),
('Eye Level with Something Small', 'Get down to ground level and photograph something from its own perspective — an ant, a fallen leaf, a discarded cup, a crack in pavement. Your lens should be within 10cm of the subject. The world from below is a different world.', 25, 80, ARRAY['universal', 'outdoor', 'nature', 'park']),
('The 40-Step Radius', 'Stand still. Take exactly 40 steps in any direction. Stop. Photograph whatever is directly in front of you at that exact moment. No choosing the angle, no waiting for something better to appear. 40 steps, stop, shoot. Then walk back and do it again in a different direction.', 20, 75, ARRAY['universal', 'outdoor']),
('Water Nearby', 'Find the nearest body of water to where you are right now — a fountain, a puddle, a river, a harbour, a glass of water on a café table counts. Photograph it so it fills at least 60% of the frame. Then photograph your reflection in it, however distorted.', 30, 90, ARRAY['universal', 'water', 'urban', 'park']),
('The Working City', 'Find someone actively doing their job in public — a courier, a market vendor, a street cleaner, a builder, a busker. Photograph them mid-task, not posing. If they notice you, thank them. If they ask what it''s for, say: documenting the city working.', 35, 115, ARRAY['universal', 'urban', 'social', 'commercial']),
('Shadow Self', 'Cast your shadow onto an interesting surface and photograph it as if the shadow is the subject, not you. The surface should tell a story — cobblestones, a painted wall, a field of grass, water. Your shadow must be recognisably human, and the surface must be interesting enough to stand alone.', 25, 85, ARRAY['universal', 'outdoor']),
('The Accidental Still Life', 'Find an arrangement that wasn''t designed to be beautiful — things left on a windowsill, items abandoned on a wall, a half-finished building site. Photograph it as if it were a deliberate composition. Reframe until it looks intentional. Don''t move anything.', 30, 90, ARRAY['universal', 'urban', 'suburban']),
('Two Generations', 'Find something old next to something new in the same frame — architecture, technology, fashion, vehicles. The contrast must be obvious. The juxtaposition must be real, not staged. Walk until you find it.', 40, 100, ARRAY['universal', 'urban', 'suburban']),
('Upward', 'Photography rule for this quest: nothing below the horizon. Only shoot upward. Find five compositions where the sky, ceiling, canopy, or overhead structure is the entire subject. No ground, no people below eye level, no looking down. Five shots, all looking up.', 30, 85, ARRAY['universal', 'outdoor', 'urban']),
('The Edge', 'Find a physical boundary — a fence, a shoreline, a wall, a doorway threshold, a kerb. Stand exactly on it. Photograph looking one way, then the other. Two photos, same spot, opposite directions. The boundary is the subject.', 25, 80, ARRAY['universal', 'outdoor', 'water', 'urban']),
('Something Being Built', 'Find evidence of construction, growth, or creation in progress — a building going up, a garden being planted, a mural being painted, bread being baked visible through a window. Photograph the process, not the result. The incompleteness is the point.', 35, 100, ARRAY['universal', 'urban', 'commercial']),
('Ground Truth', 'Look down. What''s on the ground at your feet right now? Walk one block and look down at each intersection — photograph the ground at all four corners. Four photos, four different ground surfaces, one block radius.', 20, 70, ARRAY['universal', 'urban', 'suburban']),
('The Thing No One Photographs', 'Find something in your environment that people walk past every single day without noticing or photographing — a utility box, a specific tree, a worn step, a faded sign. Photograph it as if it were the most important thing on the street. Because for the next 45 minutes, it is.', 45, 120, ARRAY['universal', 'urban', 'suburban']),
('Last Light', 'Find the spot where natural light hits best right now — through a gap in buildings, under a tree canopy, reflected off a surface. Stand in it. Photograph the light itself, not just what it''s illuminating. Light as subject.', 30, 95, ARRAY['universal', 'outdoor', 'park', 'urban']);
