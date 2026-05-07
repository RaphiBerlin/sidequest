import { supabase } from './supabase'

export async function track(event, properties = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event,
      properties
    })
  } catch (e) {
    // Never let analytics errors bubble up
  }
}

// Event constants
export const EVENTS = {
  APP_OPENED: 'app_opened',
  QUEST_DROP_SEEN: 'quest_drop_seen',
  QUEST_STARTED: 'quest_started',
  QUEST_COMPLETED: 'quest_completed',
  QUEST_SKIPPED: 'quest_skipped',
  QUEST_ABANDONED: 'quest_abandoned',
}
