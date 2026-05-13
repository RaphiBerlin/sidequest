import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuestDrop } from '../hooks/useQuestDrop'
import { useLocation } from '../hooks/useLocation'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'
import { getLocationContext } from '../lib/locationContext'
import { getInviteLink } from '../lib/invites'
import Avatar from '../components/Avatar'
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeQuest, loading: questLoading, newDrop, clearNewDrop } = useQuestDrop()
  const { location, locationError, locationLoading, requestLocation } = useLocation()
  const [profile, setProfile] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [streak, setStreak] = useState(0)
  const [freezeReady, setFreezeReady] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [locationLabel, setLocationLabel] = useState(null)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [nextDrop, setNextDrop] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [friendCount, setFriendCount] = useState(null)
  const [completedSession, setCompletedSession] = useState(null)
  const timerRef = useRef(null)

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

    supabase.from('users').select('name, streak, last_freeze_used_at, avatar_url, avatar_color').eq('id', user.id).single()
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
      .select('id, photo_url, completed_at, quest:quest_id(title)')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setRecentSessions(data || []))

    supabase.from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .then(({ count }) => setFriendCount(count ?? 0))

    supabase.from('quest_schedule')
      .select('scheduled_at')
      .eq('executed', false)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setNextDrop(data.scheduled_at) })
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

  // Check if user already completed the active quest
  useEffect(() => {
    if (!user || !activeQuest?.quest_id) { setCompletedSession(null); return }
    supabase.from('quest_sessions')
      .select('id, photo_url')
      .eq('user_id', user.id)
      .eq('quest_id', activeQuest.quest_id)
      .not('completed_at', 'is', null)
      .maybeSingle()
      .then(({ data }) => setCompletedSession(data ?? null))
  }, [user, activeQuest?.quest_id])

  // Countdown timer for active quest
  useEffect(() => {
    clearInterval(timerRef.current)
    if (!activeQuest?.expires_at) { setTimeLeft(null); return }
    function tick() {
      const ms = new Date(activeQuest.expires_at).getTime() - Date.now()
      setTimeLeft(ms > 0 ? ms : 0)
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [activeQuest])

  async function enablePushAlerts() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  async function shareInvite() {
    const link = await getInviteLink(user.id)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Sidequest', text: 'Come quest with me!', url: link })
        return
      } catch (e) {}
    }
    await navigator.clipboard.writeText(link)
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

  function formatTimeLeft(ms) {
    if (ms === null) return '--:--'
    const totalSec = Math.floor(ms / 1000)
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function formatNextDrop(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const diff = d - Date.now()
    if (diff <= 0) return 'soon'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `in ${mins}m`
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `in ${hours}h`
    return d.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  }

  const firstName = profile?.name?.split(' ')[0] ?? null

  function timeOfDay(name) {
    const h = new Date().getHours()
    const suffix = name ? `, ${name}` : ''
    if (h < 5)  return `Up Late${suffix}`
    if (h < 12) return `Good Morning${suffix}`
    if (h < 17) return `Good Afternoon${suffix}`
    if (h < 21) return `Good Evening${suffix}`
    return `Good Night${suffix}`
  }

  const locationPillLabel = locationLabel && location
    ? `◉ ${locationLabel}`
    : location ? '◉ Location active'
    : locationError ? 'No location'
    : 'No location'

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col pb-32 overflow-y-auto" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
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
      {/* Header + greeting */}
      <div className="flex items-start justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="text-rust italic text-xl leading-none mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
            Sidequest
          </h1>
          <p className="text-paper text-3xl leading-tight" style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 300 }}>
            {timeOfDay(firstName)}
          </p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="mt-1 flex-shrink-0 rounded-full overflow-hidden hover:opacity-80 transition-opacity focus:outline-none"
          title={user?.email}
        >
          <Avatar
            src={profile?.avatar_url}
            name={profile?.name || user?.email}
            color={profile?.avatar_color}
            size={36}
          />
        </button>
      </div>

      {/* ── QUEST HERO ── */}
      {!questLoading && activeQuest ? (
        <div className="px-5 mb-5">
          {completedSession ? (
            /* ── COMPLETED STATE ── */
            <div
              className="w-full rounded-2xl overflow-hidden border border-green-500/25"
              style={{ background: 'linear-gradient(160deg, rgba(42,212,122,0.07) 0%, rgba(42,212,122,0.02) 100%)' }}
            >
              {/* Top strip */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs tracking-widest uppercase text-green-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Quest completed
                  </span>
                </div>
                <span className="text-paper/25 text-xs font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  🔥 {streak}
                </span>
              </div>

              {/* Quest title + optional photo thumbnail */}
              <div className="px-5 pb-4 flex items-start gap-4">
                <div className="flex-1">
                  <h2
                    className="text-paper text-3xl leading-tight mb-2"
                    style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600 }}
                  >
                    {activeQuest.quest?.title}
                  </h2>
                  <p className="text-paper/40 text-sm">
                    You nailed it. See how others did.
                  </p>
                </div>
                {completedSession.photo_url && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-green-500/20">
                    <img
                      src={`${completedSession.photo_url}?width=128&quality=70`}
                      alt="Your submission"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* CTA bar */}
              <button
                onClick={() => navigate('/feed')}
                className="w-full flex items-center justify-between px-5 py-4 border-t border-green-500/15 hover:bg-green-500/5 transition-colors"
                style={{ background: 'rgba(42,212,122,0.04)' }}
              >
                <span className="text-green-400/70 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  See everyone's submissions
                </span>
                <span className="text-green-400 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  →
                </span>
              </button>
            </div>
          ) : (
            /* ── ACTIVE STATE ── */
            <button
              onClick={() => navigate('/quest-drop', { state: { activeQuest } })}
              className="w-full text-left rounded-2xl overflow-hidden border border-paper/20 hover:border-paper/30 transition-colors"
              style={{ background: 'linear-gradient(160deg, rgba(244,237,224,0.09) 0%, rgba(244,237,224,0.03) 100%)' }}
            >
              {/* Top strip */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#d4a02a' }} />
                  <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#d4a02a' }}>
                    Quest active
                  </span>
                </div>
                <span
                  className={`text-xs font-mono tabular-nums ${timeLeft !== null && timeLeft < 5 * 60 * 1000 ? 'text-red-400' : 'text-paper/40'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {formatTimeLeft(timeLeft)} left
                </span>
              </div>

              {/* Quest title */}
              <div className="px-5 pb-4">
                <h2
                  className="text-paper text-3xl leading-tight mb-2"
                  style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600 }}
                >
                  {activeQuest.quest?.title}
                </h2>
                {activeQuest.quest?.description && (
                  <p className="text-paper/50 text-sm leading-relaxed line-clamp-2">
                    {activeQuest.quest.description}
                  </p>
                )}
              </div>

              {/* CTA bar */}
              <div
                className="flex items-center justify-between px-5 py-4 border-t border-paper/10"
                style={{ background: 'rgba(244,237,224,0.04)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs tracking-widest ${location ? 'text-green-400/70' : 'text-paper/30'}`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {location ? `◉ ${locationLabel || 'Location active'}` : '◌ No location'}
                  </span>
                  <span className="text-paper/20 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    🔥 {streak}
                  </span>
                </div>
                <span
                  className="text-paper/70 text-sm tracking-widest uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Resume →
                </span>
              </div>
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 mb-4">
          {questLoading ? (
            <div className="bg-paper/5 border border-paper/10 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
              <p className="text-paper/40 text-sm font-mono">Checking for quest…</p>
            </div>
          ) : (
            <div className="bg-paper/5 border border-paper/10 rounded-xl p-4">
              {/* No quest message + drop button */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-paper/50 italic text-sm" style={{ fontFamily: "'Fraunces', serif" }}>Something's coming. Stay close.</p>
                  <p className="text-paper/20 text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {nextDrop ? `Next drop: ${formatNextDrop(nextDrop)}` : 'No drops scheduled'}
                  </p>
                </div>
                <button
                  onClick={simulateDrop}
                  disabled={dropping}
                  className="text-paper/20 text-xs border border-paper/10 px-3 py-1.5 hover:border-paper/30 hover:text-paper/40 transition-colors disabled:opacity-50 flex-shrink-0"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {dropping ? 'Dropping…' : 'Drop'}
                </button>
              </div>
              {/* Status row: streak + location + notif opt-in */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-paper/40 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  🔥 {streak} day{streak !== 1 ? 's' : ''}
                  {freezeReady && <span className="ml-2 text-paper/25">· freeze ready</span>}
                </span>
                <button
                  onClick={location ? undefined : requestLocation}
                  disabled={locationLoading}
                  className={`text-xs tracking-widest transition-colors ${
                    location ? 'text-green-400/60' : 'text-paper/25 hover:text-paper/40'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {locationLoading ? '◌ locating…' : location ? `◉ ${locationLabel || 'location on'}` : '◌ location off'}
                </button>
                {notifPermission === 'default' && (
                  <button
                    onClick={enablePushAlerts}
                    className="text-xs text-paper/25 hover:text-paper/50 transition-colors"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    🔔 alerts off
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Friends bar — floating rounded card above tab bar */}
      {friendCount !== null && (
        <div
          className="fixed left-5 right-5 z-40 rounded-2xl backdrop-blur-md overflow-hidden"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
            background: 'rgba(196, 72, 41, 0.22)',
            border: '1px solid rgba(196, 72, 41, 0.38)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate('/friends')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <span className="text-base">👥</span>
              <span className="text-paper/80 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {friendCount === 0
                  ? 'No friends yet'
                  : `${friendCount} friend${friendCount !== 1 ? 's' : ''}`}
              </span>
            </button>
            <button
              onClick={shareInvite}
              className="text-xs tracking-widest uppercase border border-rust/50 text-paper/80 px-3 py-1.5 rounded-lg hover:bg-rust/20 transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Invite →
            </button>
          </div>
        </div>
      )}

      {/* Journal preview strip */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-paper/40 text-xs tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Recent memories
          </p>
          <button
            onClick={() => navigate('/journal')}
            className="text-paper/30 text-xs hover:text-paper/60 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            See all →
          </button>
        </div>
        {recentSessions.length === 0 ? (
          <button
            onClick={() => navigate('/journal')}
            className="text-paper/20 text-xs hover:text-paper/40 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Your story starts with the first quest.
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate('/journal')}
                className="flex-shrink-0 flex flex-col gap-1.5 hover:opacity-80 transition-opacity"
                style={{ width: 100 }}
              >
                <div className="w-full rounded-xl bg-paper/10 overflow-hidden" style={{ height: 100 }}>
                  {s.photo_url ? (
                    <img src={`${s.photo_url}?width=300&quality=65`} alt="quest memory" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-paper/20 text-2xl">◐</div>
                  )}
                </div>
                {s.quest?.title && (
                  <p className="text-paper/40 text-xs leading-tight line-clamp-2 text-left" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                    {s.quest.title}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
