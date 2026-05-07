import { supabase } from './supabase'

export async function getInviteLink(userId) {
  const { data } = await supabase
    .from('users')
    .select('invite_code')
    .eq('id', userId)
    .single()

  const base = window.location.origin
  return `${base}/join/${data?.invite_code}`
}

export async function resolveInvite(code) {
  const { data } = await supabase
    .from('users')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  return data // { id, name } or null
}

export async function createFriendship(userId, inviterUserId) {
  // Check if friendship already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${inviterUserId}),and(user_id.eq.${inviterUserId},friend_id.eq.${userId})`)
    .maybeSingle()

  if (existing) return existing

  const { data } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: inviterUserId, status: 'accepted', tier: 'friend' })
    .select()
    .single()

  return data
}
