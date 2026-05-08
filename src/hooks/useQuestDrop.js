import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'

export function useQuestDrop() {
  const [activeQuest, setActiveQuest] = useState(undefined) // undefined = loading
  const [loading, setLoading] = useState(true)
  const [newDrop, setNewDrop] = useState(false)

  useEffect(() => {
    // Check cache before hitting Supabase
    const cached = cacheGet('active_quest')
    if (cached !== null) {
      setActiveQuest(cached)
      setLoading(false)
    }

    // Fetch current active quest on mount (joined with quest details)
    supabase
      .from('active_quest')
      .select('*, quest:quest_id(*)')
      .order('dropped_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActiveQuest(data)
        setLoading(false)
        cacheSet('active_quest', data, 5 * 60 * 1000)
      })

    // Subscribe to new quest drops
    const channel = supabase
      .channel('active_quest_drops')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'active_quest' },
        async (payload) => {
          // Fetch full quest details for the new active quest
          const { data } = await supabase
            .from('active_quest')
            .select('*, quest:quest_id(*)')
            .eq('id', payload.new.id)
            .single()
          setActiveQuest(data)
          setNewDrop(true)
          cacheSet('active_quest', data, 5 * 60 * 1000)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return { activeQuest, loading, newDrop, clearNewDrop: () => setNewDrop(false) }
}
