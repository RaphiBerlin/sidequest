import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuestDrop } from '../hooks/useQuestDrop'
import { useLocation } from '../hooks/useLocation'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'
import { getLocationContext } from '../lib/locationContext'
import FeedCard from '../components/FeedCard'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { activeQuest, loading: questLoading, newDrop, clearNewDrop } = useQuestDrop()
  const { location, locationError, locationLoading, requestLocation } = useLocation()
  const [profile, setProfile] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [streak, setStreak] = useState(0)
  const [freezeReady, setFreezeReady] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [locationLabel, setLocationLabel] = useState(null)
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  usePushSubscription(user?.id)

  useEffect(() => {
    if (!user) return

    const cachedProfile = cacheGet('user_' + user.id)
    if (cachedProfile) {
      setProfile(cachedProfile)
      setStreak(cachedProfile.streak || 0)
      const lastFreeze = cachedProfile.last_freeze_used_at ? new Date(cachedProfile.last_freeze_used_at) : null
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      setFreezeReady(!lastFreeze || lastFreeze < weekAgo)
    }

    supabase.from('users').select('name, streak, last_freeze_used_at').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setStreak(data.streak || 0)
          const lastFreeze = data.last_freeze_used_at ? new Date(data.last_freeze_used_at) : null
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          setFreezeReady(!lastFreeze || lastFreeze < weekAgo)
          cacheSet('user_' + user.id, data, 30 * 60 * 1000)
        }
      })

    supabase.from('quest_sessions')
      .select('id, photo_url, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecentSessions(data || []))

    fetchFeed()
  }, [user])

  useEffect(() => {
    if (!location) return
    getLocationContext(location.lat, location.lng).then((result) => {
      setLocationLabel(result.label)
    })
  }, [location])

  useEffect(() => {
    if (!newDrop) return
    const timer = setTimeout(() => clearNewDrop(), 6000)
    return () => clearTimeout(timer)
  }, [newDrop])

  async function fetchFeed() {
    if (!user) return
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')

      const friendIds = friendships?.map(f => f.friend_id) || []
      if (friendIds.length === 0) {
        setFeed([])
        setFeedLoading(false)
        return
      }

      const { data } = await supabase
        .from('quest_sessions')
        .select('id, completed_at, photo_url, user:users(id, name), quest:quests(title), reactions(emoji, user_id)')
        .in('user_id', friendIds)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20)

      setFeed(data || [])
    } catch (e) {
      console.error('feed error', e)
    } finally {
      setFeedLoading(false)
    }
  }

  async function enablePushAlerts() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  async function simulateDrop() {
    setDropping(true)
    try {
      let body = {}
      if (location) {
        const ctx = await getLocationContext(location.lat, location.lng)
        body = { context_tags: ctx.contexts }
      }
      await supabase.functions.invoke('drop-quest', { body })
    } catch (e) {
      console.error(e)
    }
    setDropping(false)
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  const locationPillLabel = locationLabel && location
    ? `◉ ${locationLabel}`
    : location ? '◉ Location active'
    : locationError ? 'No location'
    : 'No location'

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col pb-20 overflow-y-auto" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* Quest drop notification banner */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${newDrop ? 'translate-y-0' : '-translate-y-full'}`}
        style={{ backgroundColor: '#c44829' }}
      >
        <button
          className="w-full flex items-center gap-3 px-5 py-3 text-left"
          style={{ color: '#1a1612' }}
          onClick={() => { clearNewDrop(); navigate('/quest-drop', { state: { activeQuest } }) }}
        >
          <span className="text-lg">🔥</span>
          <span className="flex-1 text-sm font-medium" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Quest dropped! — {activeQuest?.quest?.title ?? 'New quest'}
          </span>
          <span
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}
            onClick={(e) => { e.stopPropagation(); clearNewDrop() }}
          >
            ✕
          </span>
        </button>
      </div>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <h1 className="text-rust italic text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
          Sidequest
        </h1>
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-full border border-paper/20 bg-paper/5 text-paper/60 text-sm font-medium flex items-center justify-center hover:border-rust hover:text-rust transition-colors"
          title={user?.email}
        >
          {initial}
        </button>
      </div>

      {/* Location pill */}
      <div className="px-5 mb-4">
        <button
          onClick={location ? undefined : requestLocation}
          disabled={locationLoading}
          className={`text-xs font-mono tracking-widest px-3 py-1 rounded-full border transition-colors ${
            location
              ? 'border-green-700/40 text-green-400/80 bg-green-900/10'
              : 'border-paper/20 text-paper/40 hover:border-paper/40'
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {locationLoading ? '◌ Locating…' : locationPillLabel}
        </button>

        {/* Push notification opt-in — only when permission not yet decided */}
        {notifPermission === 'default' && (
          <button
            onClick={enablePushAlerts}
            className="mt-2 text-xs border border-paper/10 text-paper/40 px-3 py-1 rounded-full hover:border-paper/20 hover:text-paper/60 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            🔔 Enable quest alerts
          </button>
        )}
      </div>

      {/* Quest state */}
      <div className="px-5 mb-4">
        {questLoading ? (
          <div className="bg-paper/5 border border-paper/10 rounded-xl p-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
            <p className="text-paper/40 text-sm font-mono">Checking for quest…</p>
          </div>
        ) : activeQuest ? (
          <div className="bg-rust/10 border border-rust/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-rust text-xl">◉</span>
              <div className="flex-1 min-w-0">
                <p className="text-paper/50 text-xs tracking-widest uppercase font-mono mb-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Quest active</p>
                <p className="text-paper text-sm italic truncate" style={{ fontFamily: "'Fraunces', serif" }}>{activeQuest.quest?.title}</p>
              </div>
              <button
                onClick={() => navigate('/quest-drop', { state: { activeQuest } })}
                className="flex-shrink-0 border border-rust text-rust text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-rust hover:text-dark transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Resume →
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-paper/5 border border-paper/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-paper/50 italic text-sm" style={{ fontFamily: "'Fraunces', serif" }}>No quest active right now.</p>
              <p className="text-paper/20 text-xs font-mono mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Next drop: today</p>
            </div>
            <button
              onClick={simulateDrop}
              disabled={dropping}
              className="text-paper/20 text-xs border border-paper/10 px-3 py-1.5 font-mono hover:border-paper/30 hover:text-paper/40 transition-colors disabled:opacity-50 flex-shrink-0"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {dropping ? 'Dropping…' : 'Drop'}
            </button>
          </div>
        )}
      </div>

      {/* Streak badge */}
      <div className="px-5 mb-4 flex items-center gap-3">
        <span className="text-paper/60 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          🔥 {streak} day streak
        </span>
        {freezeReady && (
          <span className="text-xs border border-paper/20 text-paper/40 px-2 py-0.5 rounded-full tracking-wider uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            FREEZE READY
          </span>
        )}
      </div>

      {/* Journal preview strip */}
      <div className="px-5 mb-6">
        <p className="text-paper/40 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Your memories →
        </p>
        {recentSessions.length === 0 ? (
          <p className="text-paper/20 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>No quests yet</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentSessions.map((s) => (
              <div key={s.id} className="flex-shrink-0 w-20 h-20 rounded bg-paper/10 overflow-hidden">
                {s.photo_url ? (
                  <img src={`${s.photo_url}?width=200&quality=60`} alt="quest memory" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-paper/20 text-xl">◐</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friend activity feed */}
      <div className="px-5">
        <p className="text-paper/40 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Friends' quests
        </p>
        {feedLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-paper/5 border border-paper/10 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 bg-paper/10" />
                <div className="p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-paper/10" />
                  <div className="flex-1">
                    <div className="h-3 bg-paper/10 rounded w-24 mb-1" />
                    <div className="h-2 bg-paper/10 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-8 border border-paper/10 rounded-xl bg-paper/5">
            <p className="text-paper/40 italic text-base mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No activity yet.</p>
            <p className="text-paper/20 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Add friends to see their quests here.</p>
          </div>
        ) : (
          feed.map(session => (
            <FeedCard key={session.id} session={session} currentUserId={user?.id} />
          ))
        )}
      </div>
    </div>
  )
}
