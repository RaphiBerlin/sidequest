import { supabase } from './supabase'

/**
 * Get nearby users within ~0.3 miles, ranked by distance.
 * Returns friends, friends-of-friends, and open users.
 */
export async function getNearbyUsers(userId, lat, lng) {
  const { data, error } = await supabase.rpc('get_nearby_users', {
    my_user_id: userId,
    my_lat: lat,
    my_lng: lng,
  })
  if (error) throw error
  return (data || []).map((row) => ({
    userId: row.user_id,
    name: row.name,
    avatarColor: row.avatar_color,
    distanceMiles: row.distance_miles,
    distanceFt: Math.round((row.distance_miles * 5280) / 10) * 10,
    tier: row.tier, // 'friend' | 'fof' | 'open'
    viaName: row.via_name ?? null,
    mutualCount: row.mutual_count ?? 0,
    lat: row.lat,
    lng: row.lng,
  }))
}
