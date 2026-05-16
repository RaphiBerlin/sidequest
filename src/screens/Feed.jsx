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

function questForDay(sessions, daysAgo) {
  const target = new Date()
  target.setDate(target.getDate() - daysAgo)
  const targetDate = target.toDateString()
  const daySessions = sessions.filter(s => new Date(s.completed_at).toDateString() === targetDate)
  if (!daySessions.length) return null
  const counts = {}
  for (const s of daySessions) counts[s.quest_id] = (counts[s.quest_id] || 0) + 1
  const questId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  const title = daySessions.find(s => s.quest_id === questId)?.quest?.title ?? null
  return { questId, title }
}

// ── Arc navigation ────────────────────────────────────────────────────────────

function ArcNav({ sessions, activeIndex, onSelect }) {
  const R = 185
  const originX = -125
  const step = 22

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 70, pointerEvents: 'none', zIndex: 10 }}>
      {sessions.map((session, idx) => {
        const offset = idx - activeIndex
        if (Math.abs(offset) > 4) return null
        const theta = (offset * step * Math.PI) / 180
        const x = originX + R * Math.cos(theta)
        const y = R * Math.sin(theta)
        const isActive = idx === activeIndex
        const absOff = Math.abs(offset)
        const size = isActive ? 50 : absOff === 1 ? 40 : absOff === 2 ? 32 : 24
        const opacity = isActive ? 1 : absOff === 1 ? 0.55 : absOff === 2 ? 0.28 : 0.12

        return (
          <button
            key={session.id}
            onClick={() => onSelect(idx)}
            style={{
              position: 'absolute',
              left: x,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
              width: size,
              height: size,
              borderRadius: '50%',
              overflow: 'hidden',
              opacity,
              transition: 'all 0.35s cubic-bezier(0.34, 1.2, 0.64, 1)',
              pointerEvents: 'auto',
              border: isActive ? '2px solid #d4a02a' : '1.5px solid rgba(244,237,224,0.12)',
              boxShadow: isActive ? '0 0 14px rgba(212,160,42,0.45)' : 'none',
              background: '#2a2018',
              flexShrink: 0,
            }}
          >
            {session.photo_url ? (
              <img
                src={`${session.photo_url}?width=100&quality=60`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(244,237,224,0.06)' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Social strip for active card ──────────────────────────────────────────────

function ActiveSocialStrip({ session, currentUserId, onOpenDetail }) {
  const { myReactions: mine, toggleReaction, grouped } = useReactions(session.id, currentUserId)
  const navigate = useNavigate()
  const totalReactions = Object.values(grouped).reduce((a, b) => a + b, 0)
  const commentCount = session.reactions?.length ?? 0 // placeholder until loaded

  return (
    <div style={{
      background: '#f4ede0',
      borderRadius: '0 0 14px 14px',
      width: 320,
      padding: '8px 12px 10px',
    }}>
      {/* User name */}
      {session.user?.id && session.user.id !== currentUserId && (
        <button
          onClick={() => navigate(`/profile/${session.user.id}`)}
          className="flex items-center gap-1.5 mb-2"
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(26,22,18,0.4)', letterSpacing: '0.04em' }}>
            {session.user.name}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(26,22,18,0.2)' }}>→</span>
        </button>
      )}

      {/* Reactions + comment */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FEED_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
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
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5 transition-all"
        >
          <span>💬</span>
        </button>
      </div>
    </div>
  )
}

// ── Swipeable card area ───────────────────────────────────────────────────────

function SwipeableCardArea({ displayFeed, loading, tab, safeIndex, activeSession, currentUserId, onSelect, navigate, total }) {
  const touchStartY = useRef(null)
  const touchStartX = useRef(null)
  const isDragging = useRef(false)

  function handleTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    isDragging.current = false
  }

  function handleTouchMove(e) {
    if (touchStartY.current === null) return
    const dy = e.touches[0].clientY - touchStartY.current
    const dx = e.touches[0].clientX - touchStartX.current
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      isDragging.current = true
      e.preventDefault()
    }
  }

  function handleTouchEnd(e) {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (isDragging.current && Math.abs(dy) > 40) {
      if (dy < 0 && safeIndex < total - 1) onSelect(safeIndex + 1)
      else if (dy > 0 && safeIndex > 0) onSelect(safeIndex - 1)
    }
    touchStartY.current = null
    touchStartX.current = null
    isDragging.current = false
  }

  function handleWheel(e) {
    if (Math.abs(e.deltaY) < 10) return
    if (e.deltaY > 0 && safeIndex < total - 1) onSelect(safeIndex + 1)
    else if (e.deltaY < 0 && safeIndex > 0) onSelect(safeIndex - 1)
  }

  return (
    <div
      style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingBottom: 80 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {loading ? (
        <div style={{ width: 320, aspectRatio: '2.5/3.5', borderRadius: 14, background: 'rgba(244,237,224,0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : displayFeed.length === 0 ? (
        <div className="text-center px-8">
          {tab === 'friends' ? (
            <>
              <p className="italic text-xl mb-3" style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196,72,41,0.6)' }}>
                Your friends haven't quested yet. You could be first.
              </p>
              <button onClick={() => navigate('/friends')} className="text-sm tracking-widest uppercase border px-6 py-2 rounded-lg" style={{ fontFamily: "'JetBrains Mono', monospace", borderColor: '#c44829', color: '#c44829' }}>
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
        <>
          <ArcNav sessions={displayFeed} activeIndex={safeIndex} onSelect={onSelect} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 5 }}>
            <div
              key={activeSession?.id}
              style={{ animation: 'feedCardIn 0.2s ease-out', cursor: 'pointer' }}
              onClick={() => navigate(`/session/${activeSession?.id}`)}
            >
              <QuestCard session={activeSession} />
            </div>
            {activeSession && <ActiveSocialStrip session={activeSession} currentUserId={currentUserId} />}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Feed ─────────────────────────────────────────────────────────────────

export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const { unreadCount } = useNotifications()
  const [tab, setTab] = useState('public')
  const [friendsFeed, setFriendsFeed] = useState([])
  const [publicFeed, setPublicFeed] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [publicLoading, setPublicLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const friendIdsRef = useRef([])
  const channelRef = useRef(null)
  const autoSetDoneRef = useRef(false)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, avatar_url, avatar_color').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
    fetchFriendsFeed()
    fetchPublicFeed()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user])

  useEffect(() => {
    autoSetDoneRef.current = false
    setFilter('all')
    setDropdownOpen(false)
    setActiveIndex(0)
  }, [tab])

  useEffect(() => {
    setActiveIndex(0)
  }, [filter])

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
          .order('completed_at', { ascending: false }).limit(20)
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

  const todayQuest = questForDay(feed, 0)
  const yesterdayQuest = questForDay(feed, 1)

  useEffect(() => {
    if (loading || autoSetDoneRef.current) return
    autoSetDoneRef.current = true
    if (tab === 'public') {
      if (todayQuest) setFilter('today')
      else if (yesterdayQuest) setFilter('yesterday')
    }
  }, [loading, todayQuest, yesterdayQuest])

  const filterOptions = [
    { key: 'all', label: 'All quests', sub: null },
    todayQuest ? { key: 'today', label: "Today's quest", sub: todayQuest.title } : null,
    yesterdayQuest ? { key: 'yesterday', label: "Yesterday's quest", sub: yesterdayQuest.title } : null,
  ].filter(Boolean)

  const currentOption = filterOptions.find(f => f.key === filter) ?? filterOptions[0]

  const displayFeed =
    filter === 'today' && todayQuest ? feed.filter(s => s.quest_id === todayQuest.questId) :
    filter === 'yesterday' && yesterdayQuest ? feed.filter(s => s.quest_id === yesterdayQuest.questId) :
    feed

  const safeIndex = Math.min(activeIndex, Math.max(0, displayFeed.length - 1))
  const activeSession = displayFeed[safeIndex]

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: '#1a1612',
        fontFamily: "'Bricolage Grotesque', sans-serif",
        display: 'flex', flexDirection: 'column',
      }}
    >
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

      {/* Tab toggle + filter on same row */}
      <div className="relative flex items-center justify-center px-5 mb-3 flex-shrink-0">
        {/* Tabs — truly centered */}
        <div className="flex gap-8">
          {[['public', 'Public'], ['friends', 'Friends']].map(([t, label]) => (
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

        {/* Filter dropdown — absolutely positioned to the right */}
        {!loading && filterOptions.length > 1 && (
          <div className="absolute right-5 top-0 bottom-0 flex items-center">
          <div className="relative">
            {dropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />}
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="relative z-20 flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                border: filter !== 'all' ? '1px solid rgba(196,72,41,0.5)' : '1px solid rgba(244,237,224,0.18)',
                backgroundColor: filter !== 'all' ? 'rgba(196,72,41,0.12)' : 'transparent',
                color: filter !== 'all' ? '#c44829' : 'rgba(244,237,224,0.5)',
              }}
            >
              <span className="tracking-widest uppercase">{currentOption?.label}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.15s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute top-full mt-2 z-20 rounded-2xl overflow-hidden" style={{ right: 0, minWidth: 220, backgroundColor: '#2a2018', border: '1px solid rgba(244,237,224,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {filterOptions.map((opt, i) => (
                  <button key={opt.key} onClick={() => { setFilter(opt.key); setDropdownOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    style={{ borderTop: i > 0 ? '1px solid rgba(244,237,224,0.07)' : 'none' }}
                  >
                    <div className="min-w-0 pr-3">
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: filter === opt.key ? '#c44829' : 'rgba(244,237,224,0.7)' }}>{opt.label}</p>
                      {opt.sub && <p className="text-xs mt-0.5 truncate italic" style={{ fontFamily: "'Fraunces', serif", color: 'rgba(244,237,224,0.35)' }}>{opt.sub}</p>}
                    </div>
                    {filter === opt.key && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                        <path d="M2.5 7l3 3 6-6" stroke="#c44829" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <SwipeableCardArea
        displayFeed={displayFeed}
        loading={loading}
        tab={tab}
        safeIndex={safeIndex}
        activeSession={activeSession}
        currentUserId={user?.id}
        onSelect={setActiveIndex}
        navigate={navigate}
        total={displayFeed.length}
      />

      <style>{`
        @keyframes feedCardIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
