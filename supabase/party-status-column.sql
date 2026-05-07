ALTER TABLE quest_sessions ADD COLUMN IF NOT EXISTS party_status jsonb DEFAULT '{}';
-- party_status format: { [userId]: { status: 'active' | 'completed' | 'dropped', updatedAt: ISO string } }
