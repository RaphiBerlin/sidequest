-- Run this in the Supabase SQL Editor to enable Realtime on active_quest
ALTER TABLE active_quest REPLICA IDENTITY FULL;

-- Then go to: Supabase Dashboard → Database → Replication
-- Enable the "active_quest" table for replication
