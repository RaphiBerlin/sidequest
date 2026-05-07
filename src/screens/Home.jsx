import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuestDrop } from '../hooks/useQuestDrop'
import { useLocation } from '../hooks/useLocation'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'
import { getLocationContext } from '../lib/locationContext'

export default function Home() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { activeQuest, loading: questLoading } = useQuestDrop()
  const { location, locationError, locationLoading, requestLocation } = useLocation()
  const [profile, setProfile] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [streak, setStreak] = useState(0)
  const [freezeReady, setFreezeReady] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [locationLabel, setLocationLabel] = useState(null)

  useEffect(() => {
    if (!user) return

    // Check cache before hitting Supabase for profile
    const cachedProfile = cacheGet('user_' + user.id)
    if (cachedProfile) {
      setProfile(cachedProfile)
      setStreak(cachedProfile.streak || 0)
      const lastFreeze = cachedProfile.last_freeze_used_at ? new Date(cachedProfile.last_freeze_used_at) : null
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      setFreezeReady(!lastFreeze || lastFreeze < weekAgo)
    }

    // Fetch user profile (background refresh)
    supabase.from('users').select('name, streak, last_freeze_used_at').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setStreak(data.streak || 0)
          // Freeze available if last_freeze_used_at is > 7 days ago or null
          const lastFreeze = data.last_freeze_used_at ? new Date(data.last_freeze_used_at) : null
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          setFreezeReady(!lastFreeze || lastFreeze < weekAgo)
          cacheSet('user_' + user.id, data, 30 * 60 * 1000)
        }
      })
    // Fetch recent sessions with photo_url
    supabase.from('quest_sessions')
      .select('id, photo_url, completed_at')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setRecentSessions(data || []))
  }, [user])

  useEffect(() => {
    if (!location) return
    getLocationContext(location.lat, location.lng).then((result) => {
      setLocationLabel(result.label)
    })
  }, [location])

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
  const locationPillLabel = locationLabel && location ? `◉ ${locationLabel}` : location ? '◉ Location active' : locationError ? 'No location' : 'No location'

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col pb-20" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <h1 className="text-rust italic text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
          side/quest
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
      <div className="px-5 mb-6">
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
      </div>

      {/* Quest state — main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6">
        {questLoading ? (
          <div className="w-8 h-8 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
        ) : activeQuest ? (
          <>
            <span className="text-rust text-5xl">◉</span>
            <p className="text-paper italic text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>
              Quest in progress.
            </p>
            <p className="text-paper/40 text-sm font-mono tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {activeQuest.quest?.title}
            </p>
            <button
              onClick={() => navigate('/quest-drop', { state: { activeQuest } })}
              className="border border-rust text-rust text-sm tracking-widest uppercase px-6 py-2 hover:bg-rust hover:text-dark transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Resume quest →
            </button>
          </>
        ) : (
          <>
            <span className="text-paper/20 text-6xl">◐</span>
            <p className="text-paper/60 italic text-xl" style={{ fontFamily: "'Fraunces', serif" }}>
              No quest active right now.
            </p>
            <p className="text-paper/30 text-xs font-mono tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Next drop: today
            </p>
            <button
              onClick={simulateDrop}
              disabled={dropping}
              className="text-paper/30 text-xs border border-paper/10 px-4 py-1 hover:border-paper/30 hover:text-paper/50 transition-colors mt-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {dropping ? 'Dropping…' : 'Simulate drop'}
            </button>
          </>
        )}
      </div>

      {/* Streak badge */}
      <div className="px-5 mb-4 flex items-center gap-3">
        <span className="text-paper/60 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          🔥 Streak: {streak} day{streak !== 1 ? 's' : ''}
        </span>
        {freezeReady && (
          <span className="text-xs border border-paper/20 text-paper/40 px-2 py-0.5 rounded-full tracking-wider uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            FREEZE READY
          </span>
        )}
      </div>

      {/* Journal preview strip */}
      <div className="px-5 mb-4">
        <p className="text-paper/40 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Recent memories →
        </p>
        {recentSessions.length === 0 ? (
          <p className="text-paper/20 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>No quests yet</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex-shrink-0 w-20 h-20 rounded bg-paper/10 overflow-hidden"
              >
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
    </div>
  )
}
