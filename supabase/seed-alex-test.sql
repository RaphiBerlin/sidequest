-- Seed completed quest sessions for the test friend account.
-- Run in Supabase SQL Editor.
-- Finds "Alex Test" by name and inserts 3 completed sessions.

DO $$
DECLARE
  alex_id uuid;
  quest_ids uuid[];
  q_id uuid;
  i int;
BEGIN
  -- Find Alex Test's user ID
  SELECT id INTO alex_id FROM users WHERE name ILIKE '%alex%' LIMIT 1;

  IF alex_id IS NULL THEN
    RAISE NOTICE 'Alex Test user not found — check the name in the users table';
    RETURN;
  END IF;

  RAISE NOTICE 'Found Alex Test: %', alex_id;

  -- Grab a few quest IDs
  SELECT ARRAY(SELECT id FROM quests ORDER BY random() LIMIT 3) INTO quest_ids;

  IF array_length(quest_ids, 1) IS NULL THEN
    RAISE NOTICE 'No quests found in the quests table';
    RETURN;
  END IF;

  -- Insert completed sessions spaced a few days apart
  FOR i IN 1..LEAST(3, array_length(quest_ids, 1)) LOOP
    q_id := quest_ids[i];
    INSERT INTO quest_sessions (
      user_id,
      quest_id,
      party_ids,
      started_at,
      completed_at,
      elapsed_sec,
      xp_earned
    ) VALUES (
      alex_id,
      q_id,
      '{}',
      now() - ((i * 2) || ' days')::interval,
      now() - ((i * 2) || ' days')::interval + interval '25 minutes',
      1500,
      100
    );
  END LOOP;

  RAISE NOTICE 'Inserted % quest sessions for Alex Test', LEAST(3, array_length(quest_ids, 1));
END $$;
