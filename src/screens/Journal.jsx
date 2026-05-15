import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'
import QuestCard from '../components/QuestCard'
import Avatar from '../components/Avatar'
import { useNotifications } from '../context/NotificationsContext'

const CARD_W = 320
const CARD_H = CARD_W * (3.5 / 2.5) // 448

function ScaledCard({ session, cardUser, onClick }) {
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    setScale(wrapperRef.current.offsetWidth / CARD_W)
  }, [])

  return (
    <div
      ref={wrapperRef}
      onClick={onClick}
      style={{
        width: '100%',
        height: scale ? CARD_H * scale : 'auto',
        overflow: 'hidden',
        cursor: 'pointer',
        visibility: scale ? 'visible' : 'hidden',
        flexShrink: 0,
      }}
    >
      {scale !== null && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CARD_W, pointerEvents: 'none' }}>
          <QuestCard session={{ ...session, user: cardUser, reactions: [] }} />
        </div>
      )}
    </div>
  )
}

export default function Journal() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { unreadCount } = useNotifications()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, streak: 0, coQuesters: 0 })
  const [userProfile, setUserProfile] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!user) return

    supabase
      .from('users')
      .select('name, avatar_url, avatar_color, streak')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setUserProfile(data) })

    const cached = cacheGet('journal_' + user.id)
    if (cached !== null) {
      setSessions(cached)
      setLoading(false)
    }

    async function fetchJournal() {
      const { data } = await supabase
        .from('quest_sessions')
        .select('id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, quest:quest_id(title, description, xp, context_tags, duration_min)')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .range(0, 29)

      const fetched = data || []
      setSessions(fetched)
      setLoading(false)
      if (fetched.length < 30) setHasMore(false)
      cacheSet('journal_' + user.id, fetched, 10 * 60 * 1000)

      const total = fetched.length
      const allPartyIds = fetched.flatMap(s => s.party_ids || [])
      const uniqueCoQuesters = new Set(allPartyIds).size
      const { data: u } = await supabase.from('users').select('streak').eq('id', user.id).single()
      setStats({ total, streak: u?.streak || 0, coQuesters: uniqueCoQuesters })
    }
    fetchJournal()
  }, [user])

  async function loadMore() {
    if (!user || loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const { data } = await supabase
      .from('quest_sessions')
      .select('id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, quest:quest_id(title, description, xp, context_tags, duration_min)')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .range(nextPage * 30, nextPage * 30 + 29)

    const fetched = data || []
    setSessions(prev => [...prev, ...fetched])
    setPage(nextPage)
    if (fetched.length < 30) setHasMore(false)
    setLoadingMore(false)
  }

  const cardUser = {
    name: userProfile?.name || user?.user_metadata?.full_name || 'You',
    avatar_url: userProfile?.avatar_url || null,
    avatar_color: userProfile?.avatar_color || '#c44829',
    streak: userProfile?.streak || stats.streak || 0,
  }

  return (
    <div className="screen-enter min-h-screen pb-24" style={{ background: '#1a1612' }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-6 flex items-center justify-between">
        <h1
          className="italic text-4xl"
          style={{ fontFamily: "'Fraunces', serif", color: '#f4ede0' }}
        >
          Binder
        </h1>
        <div className="flex items-center gap-3">
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
            <Avatar src={userProfile?.avatar_url} name={userProfile?.name || user?.email} color={userProfile?.avatar_color} size={36} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'QUESTS', value: stats.total },
          { label: 'STREAK', value: `${stats.streak}d` },
          { label: 'CREW', value: stats.coQuesters },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(244,237,224,0.07)', border: '1px solid rgba(244,237,224,0.1)' }}
          >
            <p
              className="text-xs mb-1 tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(244,237,224,0.4)' }}
            >
              {label}
            </p>
            <p
              className="font-bold text-2xl"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', color: '#f4ede0' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div style={{ padding: '0 12px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[1,2,3,4,5,6].map(i => (
              <div
                key={i}
                style={{
                  aspectRatio: '2.5 / 3.5',
                  borderRadius: 10,
                  background: 'rgba(244,237,224,0.06)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <p
              className="italic text-xl mb-6 leading-relaxed"
              style={{ fontFamily: "'Fraunces', serif", color: 'rgba(244,237,224,0.4)' }}
            >
              No memories yet.{'\n'}Your first quest is out there.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="border text-sm tracking-widest uppercase px-6 py-2 transition-colors"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                borderColor: '#c44829',
                color: '#c44829',
              }}
            >
              ▲ Drop a quest
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {sessions.map(session => (
              <ScaledCard
                key={session.id}
                session={session}
                cardUser={cardUser}
                onClick={() => navigate(`/session/${session.id}`)}
              />
            ))}
          </div>
        )}

        {!loading && sessions.length > 0 && hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 w-full text-xs tracking-widest uppercase py-3 transition-colors disabled:opacity-40"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              border: '1px solid rgba(244,237,224,0.15)',
              color: 'rgba(244,237,224,0.4)',
            }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
