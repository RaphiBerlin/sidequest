import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePartyInvites(currentUserId, onInvite) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`party-invites-${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'party_invites',
        filter: `to_user_id=eq.${currentUserId}`
      }, async (payload) => {
        // Fetch the sender's name
        const { data: sender } = await supabase
          .from('users')
          .select('name')
          .eq('id', payload.new.from_user_id)
          .single()

        onInvite({
          id: payload.new.id,
          sessionId: payload.new.session_id,
          fromUserId: payload.new.from_user_id,
          fromName: sender?.name || 'Someone',
          expiresAt: payload.new.expires_at
        })
      })
      .subscribe()

    channelRef.current = channel
    return () => supabase.removeChannel(channelRef.current)
  }, [currentUserId])
}
