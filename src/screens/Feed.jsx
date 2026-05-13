import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import FeedCard from '../components/FeedCard'

const SESSION_SELECT = 'id, completed_at, photo_url, is_public, user:users(id, name, avatar_url, avatar_color), quest:quests(title), reactions(emoji, user_id)'

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-dark/8 animate-pulse">
          <div className="h-36 bg-dark/8" />
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-dark/10" />
              <div className="flex-1">
                <div className="h-3 bg-dark/10 rounded w-20 mb-1.5" />
                <div className="h-2 bg-dark/8 rounded w-28" />
              </div>
              <div className="h-2 bg-dark/8 rounded w-10" />
            </div>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(j => <div key={j} className="h-7 w-10 bg-dark/6 rounded-full" />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('public') // 'public' | 'friends'
  const [friendsFeed, setFriendsFeed] = useState([])
  const [publicFeed, setPublicFeed] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicFetched, setPublicFetched] = useState(false)
  const friendIdsRef = useRef([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user) return
    fetchFriendsFeed()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user])

  // Fetch public feed (default tab) and on first switch to it
  useEffect(() => {
    if (tab === 'public' && !publicFetched) fetchPublicFeed()
  }, [tab])

  useEffect(() => {
    if (user) fetchPublicFeed()
  }, [user])

  // ── Friends feed ──────────────────────────────────────────────────────────

  async function fetchFriendsFeed() {
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const friendIds = friendships?.map(f =>
        f.user_id === user.id ? f.friend_id : f.user_id
      ) || []

      friendIdsRef.current = friendIds

      if (friendIds.length > 0) {
        const { data } = await supabase
          .from('quest_sessions')
          .select(SESSION_SELECT)
          .in('user_id', friendIds)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(20)
        setFriendsFeed(data || [])
      }

      subscribeToSessions()
    } catch (e) {
      console.error('friends feed error', e)
    } finally {
      setFriendsLoading(false)
    }
  }

  // ── Public feed ───────────────────────────────────────────────────────────

  async function fetchPublicFeed() {
    setPublicLoading(true)
    try {
      const { data } = await supabase
        .from('quest_sessions')
        .select(SESSION_SELECT)
        .eq('is_public', true)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(30)
      setPublicFeed(data || [])
      setPublicFetched(true)
    } catch (e) {
      console.error('public feed error', e)
    } finally {
      setPublicLoading(false)
    }
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  function subscribeToSessions() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel('feed-sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quest_sessions' }, async (payload) => {
        if (!payload.new.completed_at) return
        if (friendIdsRef.current.includes(payload.new.user_id)) {
          const s = await fetchSession(payload.new.id)
          if (s) setFriendsFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
        if (payload.new.is_public) {
          const s = await fetchSession(payload.new.id)
          if (s) setPublicFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quest_sessions' }, async (payload) => {
        const n = payload.new
        const o = payload.old
        // New completion on a friend's session
        if (n.completed_at && !o.completed_at && friendIdsRef.current.includes(n.user_id)) {
          const s = await fetchSession(n.id)
          if (s) setFriendsFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
        // Session made public (toggle on)
        if (n.is_public && !o.is_public) {
          const s = await fetchSession(n.id)
          if (s) setPublicFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
        // Session made private (toggle off) — remove from public feed
        if (!n.is_public && o.is_public) {
          setPublicFeed(prev => prev.filter(x => x.id !== n.id))
        }
      })
      .subscribe()
  }

  async function fetchSession(id) {
    const { data } = await supabase
      .from('quest_sessions')
      .select(SESSION_SELECT)
      .eq('id', id)
      .single()
    return data
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const feed = tab === 'friends' ? friendsFeed : publicFeed
  const loading = tab === 'friends' ? friendsLoading : publicLoading

  return (
    <div className="min-h-screen bg-paper pb-24" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <h1 className="italic text-4xl text-dark" style={{ fontFamily: "'Fraunces', serif" }}>
          Feed
        </h1>
        <button
          onClick={() => navigate('/friends')}
          className="mt-1 text-xs border border-dark/20 text-dark/40 px-3 py-1.5 rounded-full hover:border-dark/40 hover:text-dark/60 transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Friends →
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex justify-center gap-8 mb-5">
        {[['public', 'Public'], ['friends', 'Friends']].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm tracking-widest uppercase transition-colors pb-0.5 ${
              tab === t
                ? 'text-dark border-b-2 border-dark'
                : 'text-dark/30 hover:text-dark/50'
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feed content */}
      <div className="px-5">
        {loading ? (
          <SkeletonCards />
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {tab === 'friends' ? (
              <>
                <p className="italic text-xl mb-3 leading-relaxed"
                  style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196, 72, 41, 0.6)' }}>
                  Your friends haven't quested yet today. You could be first.
                </p>
                <p className="text-dark/30 text-xs mb-6"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Complete a quest and your card appears here.
                </p>
                <button
                  onClick={() => navigate('/friends')}
                  className="text-sm tracking-widest uppercase border px-6 py-2 rounded-lg transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace", borderColor: '#c44829', color: '#c44829' }}
                >
                  → Find friends
                </button>
              </>
            ) : (
              <>
                <p className="italic text-xl mb-3 leading-relaxed"
                  style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196, 72, 41, 0.6)' }}>
                  Nothing public yet.
                </p>
                <p className="text-dark/30 text-xs"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Complete a quest and share it to the public feed.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.map(session => (
              <FeedCard key={session.id} session={session} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
