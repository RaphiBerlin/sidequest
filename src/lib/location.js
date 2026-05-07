import { supabase } from './supabase'

/**
 * Write the user's current GPS location to the presence table.
 * Only call this when a quest is active.
 */
export function writePresence(userId) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { lat, lng } = { lat: coords.latitude, lng: coords.longitude }
        const { error } = await supabase
          .from('presence')
          .upsert({ user_id: userId, lat, lng, updated_at: new Date().toISOString() })
        if (error) { reject(error); return }
        resolve({ lat, lng })
      },
      (err) => {
        if (err.code === 1) reject(new Error('Location permission denied'))
        else if (err.code === 2) reject(new Error('Location unavailable'))
        else if (err.code === 3) reject(new Error('Location request timed out'))
        else reject(err)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}

/**
 * Delete the user's presence row when quest ends.
 */
export async function deletePresence(userId) {
  await supabase.from('presence').delete().eq('user_id', userId)
}
