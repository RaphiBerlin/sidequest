import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePartySync(sessionId, currentUserId, onPartyUpdate) {
  // onPartyUpdate(partyStatuses) is called whenever party_status changes
  const intervalRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!sessionId || !currentUserId) return

    // Subscribe to UPDATE events on quest_sessions for this session
    const channel = supabase
      .channel(`party-sync-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quest_sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        if (payload.new?.party_status) {
          onPartyUpdate(payload.new.party_status)
        }
      })
      .subscribe()
    channelRef.current = channel

    // Every 15 seconds: update current user's status to 'active'
    async function heartbeat() {
      const { data } = await supabase
        .from('quest_sessions')
        .select('party_status')
        .eq('id', sessionId)
        .single()

      const current = data?.party_status || {}
      current[currentUserId] = { status: 'active', updatedAt: new Date().toISOString() }

      await supabase
        .from('quest_sessions')
        .update({ party_status: current })
        .eq('id', sessionId)
    }

    heartbeat() // immediate first call
    intervalRef.current = setInterval(heartbeat, 15000)

    return () => {
      clearInterval(intervalRef.current)
      supabase.removeChannel(channelRef.current)
    }
  }, [sessionId, currentUserId])

  async function markCompleted() {
    const { data } = await supabase
      .from('quest_sessions')
      .select('party_status')
      .eq('id', sessionId)
      .single()

    const current = data?.party_status || {}
    current[currentUserId] = { status: 'completed', updatedAt: new Date().toISOString() }

    await supabase
      .from('quest_sessions')
      .update({ party_status: current })
      .eq('id', sessionId)
  }

  return { markCompleted }
}
