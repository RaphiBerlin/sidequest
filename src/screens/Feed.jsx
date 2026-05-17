import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import QuestCard from '../components/QuestCard'
import { useNotifications } from '../context/NotificationsContext'
import { useReactions } from '../hooks/useReactions'

const SESSION_SELECT = 'id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, is_public, user:users(id, name, avatar_url, avatar_color, streak), quest:quests(title, description, xp, context_tags, duration_min), reactions(emoji, user_id)'
const FEED_EMOJIS = ['🔥', '✨', '😂', '🙌', '🥲']
const CARD_WIDTH = Math.min(window.innerWidth - 32, 360)

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function groupByDay(sessions) {
  const groups = []
  const map = {}
  for (const s of sessions) {
    const key = new Date(s.completed_at).toDateString()
    if (!map[key]) {
      map[key] = { label: dayLabel(s.completed_at), sessions: [] }
      groups.push(map[key])
    }
    map[key].sessions.push(s)
  }
  return groups
}

// ── Social strip ──────────────────────────────────────────────────────────────

function SocialStrip({ session, currentUserId }) {
  const { myReactions: mine, toggleReaction, grouped } = useReactions(session.id, currentUserId)
  const navigate = useNavigate()
  const isOwnCard = session.user?.id === currentUserId

  return (
    <div style={{
      background: '#f4ede0',
      borderRadius: '0 0 14px 14px',
      width: CARD_WIDTH,
      padding: '8px 12px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {!isOwnCard && session.user?.id ? (
        <button onClick={() => navigate(`/profile/${session.user.id}`)} style={{ flexShrink: 0, padding: 0 }}>
          <Avatar src={session.user.avatar_url} name={session.user.name} color={session.user.avatar_color} size={32} />
        </button>
      ) : (
        <div style={{ width: 32, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
        {FEED_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-full text-xs transition-all ${
              mine.has(emoji)
                ? 'bg-rust/15 border border-rust/40 scale-110'
                : grouped[emoji] > 0
                  ? 'bg-dark/5 border border-dark/15'
                  : 'border border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5'
            }`}
          >
            <span>{emoji}</span>
            {grouped[emoji] > 0 && (
              <span className="text-dark/50 font-mono">{grouped[emoji]}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => navigate(`/session/${session.id}`)}
          className="flex items-center gap-1 px-1.5 py-1 rounded-full text-xs border border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5 transition-all"
          style={{ marginLeft: 'auto' }}
        >
          <span>💬</span>
        </button>
      </div>
    </div>
  )
}

// ── Main Feed ─────────────────────────────────────────────────────────────────

export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()

  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('friends')
  const [friendsFeed, setFriendsFeed] = useState([])
  const [publicFeed, setPublicFeed] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [publicLoading, setPublicLoading] = useState(true)

  const friendIdsRef = useRef([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, avatar_url, avatar_color').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
    fetchFriendsFeed()
    fetchPublicFeed()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user])

  async function fetchFriendsFeed() {
    try {
      const { data: friendships } = await supabase
        .from('friendships').select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`).eq('status', 'accepted')
      const friendIds = friendships?.map(f => f.user_id === user.id ? f.friend_id : f.user_id) || []
      friendIdsRef.current = friendIds
      if (friendIds.length > 0) {
        const { data } = await supabase.from('quest_sessions').select(SESSION_SELECT)
          .in('user_id', friendIds).not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }).limit(30)
        setFriendsFeed(data || [])
      } else {
        setFriendsFeed([])
      }
      subscribeToSessions()
    } catch (e) { console.error('friends feed error', e) }
    finally { setFriendsLoading(false) }
  }

  async function fetchPublicFeed() {
    try {
      const { data } = await supabase.from('quest_sessions').select(SESSION_SELECT)
        .eq('is_public', true).not('completed_at', 'is', null)
        .order('completed_at', { ascending: false }).limit(30)
      setPublicFeed(data || [])
    } catch (e) { console.error('public feed error', e) }
    finally { setPublicLoading(false) }
  }

  function subscribeToSessions() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel('feed-sessions')
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
        const n = payload.new, o = payload.old
        if (n.completed_at && !o.completed_at && friendIdsRef.current.includes(n.user_id)) {
          const s = await fetchSession(n.id)
          if (s) setFriendsFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
        if (n.is_public && !o.is_public) {
          const s = await fetchSession(n.id)
          if (s) setPublicFeed(prev => prev.find(x => x.id === s.id) ? prev : [s, ...prev])
        }
        if (!n.is_public && o.is_public) setPublicFeed(prev => prev.filter(x => x.id !== n.id))
      })
      .subscribe()
  }

  async function fetchSession(id) {
    const { data } = await supabase.from('quest_sessions').select(SESSION_SELECT).eq('id', id).single()
    return data
  }

  const feed = tab === 'friends' ? friendsFeed : publicFeed
  const loading = tab === 'friends' ? friendsLoading : publicLoading
  const groups = groupByDay(feed)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1612', fontFamily: "'Bricolage Grotesque', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between flex-shrink-0">
        <h1 className="italic text-4xl" style={{ fontFamily: "'Fraunces', serif", color: '#f4ede0' }}>
          Feed
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/friends')}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ fontFamily: "'JetBrains Mono', monospace", border: '1px solid rgba(244,237,224,0.2)', color: 'rgba(244,237,224,0.4)' }}
          >
            Friends →
          </button>
          <button onClick={() => navigate('/notifications')} className="relative flex-shrink-0 focus:outline-none" style={{ color: 'rgba(244,237,224,0.5)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: '#c44829', color: '#f4ede0', fontFamily: "'JetBrains Mono', monospace", padding: '0 3px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/settings')} className="flex-shrink-0 rounded-full overflow-hidden hover:opacity-80 transition-opacity focus:outline-none">
            <Avatar src={profile?.avatar_url} name={profile?.name || user?.email} color={profile?.avatar_color} size={36} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center px-5 mb-3 flex-shrink-0">
        <div className="flex gap-8">
          {[['friends', 'Friends'], ['public', 'Discovery']].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-sm tracking-widest uppercase pb-0.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: tab === t ? '#f4ede0' : 'rgba(244,237,224,0.3)',
                borderBottom: tab === t ? '2px solid #f4ede0' : '2px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable feed */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: CARD_WIDTH, aspectRatio: '2.5/3.5', borderRadius: 14, background: 'rgba(244,237,224,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center px-8 pt-16">
            {tab === 'friends' ? (
              <>
                <p className="italic text-xl mb-3" style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196,72,41,0.6)' }}>
                  Your friends haven't quested yet.
                </p>
                <button onClick={() => navigate('/friends')} className="text-sm tracking-widest uppercase border px-6 py-2 rounded-lg"
                  style={{ fontFamily: "'JetBrains Mono', monospace", borderColor: '#c44829', color: '#c44829' }}>
                  → Find friends
                </button>
              </>
            ) : (
              <p className="italic text-xl" style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196,72,41,0.6)' }}>
                Nothing public yet.
              </p>
            )}
          </div>
        ) : (
          <div style={{ paddingBottom: 100 }}>
            {groups.map((group, gi) => (
              <div key={gi}>
                {/* Date divider */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: gi === 0 ? '0 16px 20px' : '28px 16px 20px',
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                    color: group.label === 'Today' ? '#d4a02a' : 'rgba(244,237,224,0.35)',
                  }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(244,237,224,0.08)' }} />
                </div>

                {/* Cards */}
                {group.sessions.map(session => (
                  <div key={session.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => navigate(`/session/${session.id}`)}>
                      <QuestCard session={session} width={CARD_WIDTH} />
                    </div>
                    <SocialStrip session={session} currentUserId={user?.id} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
