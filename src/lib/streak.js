import { supabase } from './supabase'

function toDateStr(date) {
  return date.toISOString().split('T')[0] // YYYY-MM-DD
}

function daysBetween(a, b) {
  const ms = Math.abs(new Date(a) - new Date(b))
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Call this after a quest is completed.
 * Increments streak if first completion today, handles streak logic.
 * @returns {Promise<number>} New streak value
 */
export async function updateStreak(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('streak, last_quest_date')
    .eq('id', userId)
    .single()

  if (!user) return 0

  const today = toDateStr(new Date())
  const lastDate = user.last_quest_date

  // Already counted today
  if (lastDate === today) return user.streak

  let newStreak
  if (!lastDate) {
    // First ever quest
    newStreak = 1
  } else {
    const days = daysBetween(lastDate, today)
    if (days === 1) {
      // Completed yesterday → increment
      newStreak = (user.streak || 0) + 1
    } else {
      // Missed day(s) → reset (freeze check is handled separately on app open)
      newStreak = 1
    }
  }

  await supabase.from('users').update({ streak: newStreak, last_quest_date: today }).eq('id', userId)
  return newStreak
}

/**
 * Call on app open / home screen mount.
 * Checks if streak should be reset due to missed day.
 * @returns {Promise<{streakLost: boolean, freezeAvailable: boolean, streak: number}>}
 */
export async function checkAndResetStreak(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('streak, last_quest_date, last_freeze_used_at')
    .eq('id', userId)
    .single()

  if (!user || !user.last_quest_date || !user.streak) {
    return { streakLost: false, freezeAvailable: false, streak: user?.streak || 0 }
  }

  const today = toDateStr(new Date())
  const days = daysBetween(user.last_quest_date, today)

  // Streak is fine (completed today or yesterday)
  if (days <= 1) return { streakLost: false, freezeAvailable: false, streak: user.streak }

  // Missed at least one day — check freeze
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const lastFreeze = user.last_freeze_used_at ? new Date(user.last_freeze_used_at) : null
  const freezeAvailable = !lastFreeze || lastFreeze < weekAgo

  if (freezeAvailable) {
    // Offer the freeze — don't reset yet
    return { streakLost: false, freezeAvailable: true, streak: user.streak }
  }

  // No freeze — reset streak
  await supabase.from('users').update({ streak: 0 }).eq('id', userId)
  return { streakLost: true, freezeAvailable: false, streak: 0 }
}

/**
 * Use the weekly streak freeze to protect streak on a missed day.
 * @returns {Promise<void>}
 */
export async function useFreeze(userId) {
  await supabase.from('users').update({
    last_freeze_used_at: new Date().toISOString(),
    // Extend last_quest_date to yesterday so streak check passes
    last_quest_date: toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  }).eq('id', userId)
}
