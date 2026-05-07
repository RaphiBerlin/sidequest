import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useReactions(sessionId, currentUserId) {
  const [reactions, setReactions] = useState([])  // all reactions: [{ id, session_id, user_id, emoji, user: { name } }]
  const [myReactions, setMyReactions] = useState(new Set()) // set of emojis I've reacted with

  useEffect(() => {
    if (!sessionId) return

    // Fetch initial reactions
    supabase
      .from('reactions')
      .select('id, session_id, user_id, emoji')
      .eq('session_id', sessionId)
      .then(({ data }) => {
        if (data) {
          setReactions(data)
          setMyReactions(new Set(
            data.filter(r => r.user_id === currentUserId).map(r => r.emoji)
          ))
        }
      })

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`reactions-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reactions',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setReactions(prev => [...prev, payload.new])
        if (payload.new.user_id === currentUserId) {
          setMyReactions(prev => new Set([...prev, payload.new.emoji]))
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'reactions',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setReactions(prev => prev.filter(r => r.id !== payload.old.id))
        if (payload.old.user_id === currentUserId) {
          setMyReactions(prev => {
            const next = new Set(prev)
            next.delete(payload.old.emoji)
            return next
          })
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId, currentUserId])

  async function toggleReaction(emoji) {
    if (!sessionId || !currentUserId) return

    if (myReactions.has(emoji)) {
      // Delete
      const row = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji)
      if (row) {
        await supabase.from('reactions').delete().eq('id', row.id)
        // Optimistic update (realtime will also update)
        setReactions(prev => prev.filter(r => r.id !== row.id))
        setMyReactions(prev => { const next = new Set(prev); next.delete(emoji); return next })
      }
    } else {
      // Insert
      const { data } = await supabase.from('reactions').insert({
        session_id: sessionId,
        user_id: currentUserId,
        emoji
      }).select().single()
      if (data) {
        setReactions(prev => [...prev, data])
        setMyReactions(prev => new Set([...prev, emoji]))
      }
    }
  }

  // Group reactions by emoji with counts
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1
    return acc
  }, {})

  return { reactions, myReactions, toggleReaction, grouped }
}
