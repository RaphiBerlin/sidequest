-- Trigger: notify all friends when a user completes a quest

CREATE OR REPLACE FUNCTION notify_friends_on_quest_complete()
RETURNS TRIGGER AS $$
DECLARE
  quest_title TEXT;
BEGIN
  -- Only fire when completed_at transitions NULL → value
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN

    SELECT title INTO quest_title FROM quests WHERE id = NEW.quest_id;

    INSERT INTO notifications (user_id, type, from_user_id, data)
    SELECT
      CASE
        WHEN f.user_id = NEW.user_id THEN f.friend_id
        ELSE f.user_id
      END,
      'friend_quest_complete',
      NEW.user_id,
      jsonb_build_object('quest_title', COALESCE(quest_title, 'a quest'), 'session_id', NEW.id)
    FROM friendships f
    WHERE (f.user_id = NEW.user_id OR f.friend_id = NEW.user_id)
      AND f.status = 'accepted';

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists so this is safe to re-run
DROP TRIGGER IF EXISTS on_quest_session_complete ON quest_sessions;

CREATE TRIGGER on_quest_session_complete
  AFTER UPDATE ON quest_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_friends_on_quest_complete();
