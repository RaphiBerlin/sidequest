import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuestDrop } from '../hooks/useQuestDrop'
import { getLocationContext } from '../lib/locationContext'
import { useLocation as useUserLocation } from '../hooks/useLocation'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import { useToast } from '../context/ToastContext'

function haversineFt(lat1, lng1, lat2, lng2) {
  const R = 20902231
  const toR = d => d * Math.PI / 180
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function cardinal(lat1, lng1, lat2, lng2) {
  const toR = d => d * Math.PI / 180
  const x = Math.sin(toR(lng2 - lng1)) * Math.cos(toR(lat2))
  const y = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) - Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(toR(lng2 - lng1))
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(((Math.atan2(x, y) * 180 / Math.PI + 360) % 360) / 45) % 8]
}
function fmtDist(ft) {
  return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : `${(ft / 5280).toFixed(1)} mi`
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

export default function QuestDrop() {
  const navigate = useNavigate()
  const routerState = useLocation().state
  const { user } = useAuth()
  const { activeQuest: liveQuest } = useQuestDrop()
  const { location } = useUserLocation()
  const { showToast } = useToast()
  const [now, setNow] = useState(new Date())
  const [contextLabel, setContextLabel] = useState(null)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendPresence, setFriendPresence] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [inviting, setInviting] = useState(false)
  const [waitForCrew, setWaitForCrew] = useState(false)

  // Drag state
  const dragStartY = useRef(null)
  const dragDeltaY = useRef(0)
  const sheetRef = useRef(null)

  const aq = routerState?.activeQuest ?? liveQuest
  const quest = aq?.quest

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!location) return
    getLocationContext(location.lat, location.lng).then((result) => {
      setContextLabel(result.label)
    })
  }, [location])

  // Load friends when crew panel opens
  useEffect(() => {
    if (!crewOpen || !user || friends.length) return
    setFriendsLoading(true)
    async function load() {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')
      const ids = (friendships || []).map(f =>
        f.user_id === user.id ? f.friend_id : f.user_id
      )
      if (!ids.length) { setFriendsLoading(false); return }
      const { data } = await supabase
        .from('users')
        .select('id, name, avatar_url, avatar_color, streak')
        .in('id', ids)
        .order('name')
      setFriends(data || [])
      // Fetch presence for distance/direction display
      const { data: presence } = await supabase
        .from('presence')
        .select('user_id, lat, lng')
        .in('user_id', ids)
      const map = {}
      presence?.forEach(r => { map[r.user_id] = { lat: r.lat, lng: r.lng } })
      setFriendPresence(map)
      setFriendsLoading(false)
    }
    load()
  }, [crewOpen, user])

  function toggleFriend(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function skip() {
    localStorage.setItem('sidequest_skipped_date', new Date().toDateString())
    navigate('/home')
  }

  function goSolo() {
    navigate('/active-quest', { state: { activeQuest: aq } })
  }

  async function inviteAndStart() {
    if (!user || !aq) return
    setInviting(true)
    try {
      // 1. Create the quest session first so we have a session_id to share
      const { data: session, error: sessionError } = await supabase
        .from('quest_sessions')
        .insert({
          quest_id: aq.quest_id,
          user_id: user.id,
          party_ids: [...selected],
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (sessionError || !session) {
        console.error('Session creation failed:', sessionError)
        showToast('Could not start quest — please try again', 'error')
        setInviting(false)
        return
      }

      // Persist so ActiveQuest skips re-creating it
      localStorage.setItem('sq_session_id', session.id)

      // 2. Insert one crew_invite row per invited friend
      const inviteRows = [...selected].map(friendId => ({
        session_id: session.id,
        from_user_id: user.id,
        to_user_id: friendId,
        status: 'pending',
        creator_waiting: waitForCrew,
      }))
      const { data: createdInvites } = await supabase
        .from('crew_invites')
        .insert(inviteRows)
        .select('id, to_user_id')

      // 3. Insert quest_invite notifications with session + invite ids
      if (createdInvites?.length) {
        const notifications = createdInvites.map(inv => ({
          user_id: inv.to_user_id,
          from_user_id: user.id,
          type: 'quest_invite',
          data: {
            crew_invite_id: inv.id,
            session_id: session.id,
            quest_title: quest?.title,
            quest_id: aq.quest_id,
            active_quest: aq,
          },
        }))
        await supabase.from('notifications').insert(notifications)
      }

      // 4. Navigate — wait screen or straight to active quest
      const invitedFriends = friends.filter(f => selected.has(f.id))
      if (waitForCrew) {
        navigate('/crew-waiting', { state: { activeQuest: aq, sessionId: session.id, invitedFriends } })
      } else {
        navigate('/active-quest', { state: { activeQuest: aq } })
      }
    } catch (e) {
      console.error('inviteAndStart error:', e)
      showToast('Could not start quest — please try again', 'error')
      setInviting(false)
    }
  }

  // Touch drag on the handle
  function onDragStart(e) {
    dragStartY.current = e.touches[0].clientY
    dragDeltaY.current = 0
  }
  function onDragMove(e) {
    dragDeltaY.current = e.touches[0].clientY - dragStartY.current
  }
  function onDragEnd() {
    if (dragDeltaY.current > 60) {
      if (crewOpen) { setCrewOpen(false); setSelected(new Set()) }
      else setSheetOpen(false)
    } else if (dragDeltaY.current < -60) {
      setSheetOpen(true)
    }
    dragStartY.current = null
    dragDeltaY.current = 0
  }

  // Crew mode: fixed tall height for the scrollable friend list.
  // Brief mode: auto-size to content so short descriptions don't leave dead space.
  const sheetStyle = crewOpen
    ? { height: selected.size > 0 ? '96vh' : '88vh' }
    : { height: 'auto', minHeight: '30vh', maxHeight: '82vh' }

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col items-center justify-center px-5 py-12 gap-6 relative overflow-hidden">

      {/* ── Backdrop dimmer when sheet open ── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-10"
          style={{ background: 'rgba(26,22,18,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => { setSheetOpen(false); setCrewOpen(false); setSelected(new Set()) }}
        />
      )}

      {/* Incoming label */}
      <p
        className="text-gold text-xs tracking-[0.3em] uppercase animate-pulse"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        ▲ QUEST INCOMING ▲
      </p>

      {/* Time */}
      <div className="text-center">
        <p className="text-paper text-6xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>
          {formatTime(now)}
        </p>
        <p className="text-paper/40 text-xs tracking-widest mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {formatDate(now)}
        </p>
      </div>

      {/* Quest card */}
      <div
        className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl p-5 relative"
        style={{ transform: 'rotate(-1.5deg)' }}
      >
        <div className="absolute -top-3 left-4 bg-rust text-dark text-xs font-bold px-3 py-1 tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          TODAY'S QUEST
        </div>
        <div className="absolute -top-3 right-4 border-2 border-rust text-rust text-[9px] font-bold px-2 py-1 rounded-full tracking-wider uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {quest?.duration_min ?? 45} MIN
        </div>
        {contextLabel && (
          <p className="text-rust text-xs font-mono tracking-widest mb-2">▾ TAILORED FOR {contextLabel.toUpperCase()}</p>
        )}
        <h2 className="text-dark italic text-3xl leading-tight my-4" style={{ fontFamily: "'Fraunces', serif" }}>
          {quest?.title ?? 'Loading quest…'}
        </h2>
        <div className="flex gap-2 mt-4 flex-wrap">
          {[
            { label: 'DURATION', value: `${quest?.duration_min ?? 25} MIN` },
            { label: 'PARTY', value: '2–4 PPL' },
            { label: 'RADIUS', value: '0.3 MI' },
          ].map(({ label, value }) => (
            <div key={label} className="border border-dark/20 rounded-full px-3 py-1 text-[10px] tracking-widest text-dark/60 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {label}: {value}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => setSheetOpen(true)}
        className="w-full max-w-sm bg-rust text-dark text-sm tracking-widest uppercase py-4 font-bold hover:opacity-90 transition-opacity"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        READ THE BRIEF →
      </button>

      {/* Skip */}
      <button
        onClick={skip}
        className="text-paper/20 text-xs tracking-widest hover:text-paper/50 transition-colors"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Skip today's quest
      </button>

      {/* ── Half-sheet ── */}
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-20 flex flex-col"
        style={{
          ...sheetStyle,
          background: '#f4ede0',
          borderRadius: '20px 20px 0 0',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(26,22,18,0.15)' }} />
          <p className="text-xs tracking-[0.25em] uppercase mt-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.35)' }}>
            The Brief
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-4">

          {/* Title */}
          <h2 className="text-4xl leading-tight mb-4" style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', color: '#1a1612', fontWeight: 600 }}>
            {quest?.title}
          </h2>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {quest?.xp && (
              <span className="text-[10px] tracking-widest uppercase px-3 py-1 rounded-full" style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(212,160,42,0.12)', border: '1px solid rgba(212,160,42,0.3)', color: '#a07a10' }}>
                +{quest.xp} XP
              </span>
            )}
            {quest?.duration_min && (
              <span className="text-[10px] tracking-widest uppercase px-3 py-1 rounded-full" style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(26,22,18,0.06)', border: '1px solid rgba(26,22,18,0.12)', color: 'rgba(26,22,18,0.5)' }}>
                {quest.duration_min} min
              </span>
            )}
            {(quest?.context_tags || []).map(tag => (
              <span key={tag} className="text-[10px] tracking-widest uppercase px-3 py-1 rounded-full" style={{ fontFamily: "'JetBrains Mono', monospace", background: 'rgba(196,72,41,0.08)', border: '1px solid rgba(196,72,41,0.2)', color: 'rgba(196,72,41,0.7)' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Description */}
          {quest?.description && (
            <p className="leading-relaxed text-base mb-6" style={{ color: 'rgba(26,22,18,0.75)' }}>
              {quest.description}
            </p>
          )}

          {/* Crew picker (expanded) */}
          {crewOpen && (
            <div className="mb-4">
              <p className="text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.35)' }}>
                Pick your crew
              </p>
              {friendsLoading ? (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(26,22,18,0.3)' }}>Loading…</p>
              ) : friends.length === 0 ? (
                <div className="text-center py-4">
                  <p className="italic text-sm mb-2" style={{ fontFamily: "'Fraunces', serif", color: 'rgba(26,22,18,0.4)' }}>No friends yet.</p>
                  <button onClick={() => navigate('/friends')} className="text-xs tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#c44829' }}>
                    Find friends →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {friends.map(f => {
                    const isSel = selected.has(f.id)
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: isSel ? 'rgba(196,72,41,0.1)' : 'rgba(26,22,18,0.04)',
                          border: `1px solid ${isSel ? 'rgba(196,72,41,0.4)' : 'rgba(26,22,18,0.1)'}`,
                        }}
                      >
                        <Avatar src={f.avatar_url} name={f.name} color={f.avatar_color} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1a1612' }}>{f.name}</p>
                          {f.streak > 0 && (
                            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(26,22,18,0.3)' }}>
                              🔥 {f.streak} streak
                            </p>
                          )}
                        </div>
                        {(() => {
                          const p = friendPresence[f.id]
                          if (!p || !location) return null
                          const ft = haversineFt(location.lat, location.lng, p.lat, p.lng)
                          const dir = cardinal(location.lat, location.lng, p.lat, p.lng)
                          return (
                            <div className="flex-shrink-0 text-right mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(26,22,18,0.6)' }}>{fmtDist(ft)}</p>
                              <p style={{ fontSize: 9, letterSpacing: '0.12em', color: 'rgba(26,22,18,0.35)', marginTop: 1 }}>{dir}</p>
                            </div>
                          )
                        })()}
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ background: isSel ? '#c44829' : 'transparent', border: `1.5px solid ${isSel ? '#c44829' : 'rgba(26,22,18,0.2)'}` }}
                        >
                          {isSel && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l2.5 2.5L9 1" stroke="#f4ede0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky bottom buttons */}
        <div className="flex-shrink-0 px-6 pb-10 pt-3" style={{ borderTop: '1px solid rgba(26,22,18,0.07)' }}>
          {crewOpen ? (
            <div className="flex flex-col gap-2">
              {/* Wait toggle — only show when friends are selected */}
              {selected.size > 0 && (
                <div className="mb-1">
                  <p className="text-[10px] tracking-widest uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.35)' }}>
                    When do you want to start?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { val: false, label: 'Start now', sub: 'Friends can join as you go' },
                      { val: true,  label: 'Wait for crew', sub: 'Hold until they accept' },
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        onClick={() => setWaitForCrew(opt.val)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
                        style={{
                          background: waitForCrew === opt.val ? 'rgba(196,72,41,0.1)' : 'rgba(26,22,18,0.04)',
                          border: `1px solid ${waitForCrew === opt.val ? 'rgba(196,72,41,0.4)' : 'rgba(26,22,18,0.1)'}`,
                        }}
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{ border: `1.5px solid ${waitForCrew === opt.val ? '#c44829' : 'rgba(26,22,18,0.25)'}` }}>
                          {waitForCrew === opt.val && <div className="w-2 h-2 rounded-full" style={{ background: '#c44829' }} />}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1a1612', letterSpacing: '0.05em' }}>{opt.label}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.4)', fontSize: 10 }}>{opt.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={inviteAndStart}
                disabled={inviting || selected.size === 0}
                className="w-full py-4 text-sm tracking-widest uppercase font-bold transition-opacity disabled:opacity-35"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: '#c44829', color: '#f4ede0', borderRadius: 12 }}
              >
                {inviting ? 'Sending…' : selected.size === 0 ? 'Select friends' : `Invite ${selected.size} & ${waitForCrew ? 'Wait →' : 'Start →'}`}
              </button>
              <button
                onClick={() => { setCrewOpen(false); setSelected(new Set()) }}
                className="w-full py-2.5 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.4)' }}
              >
                ← Back
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setCrewOpen(true)}
                className="w-full py-4 text-sm tracking-widest uppercase font-bold"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: '#c44829', color: '#f4ede0', borderRadius: 12 }}
              >
                Start with Crew +
              </button>
              <button
                onClick={goSolo}
                className="w-full py-3.5 text-sm tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace', border: '1px solid rgba(26,22,18,0.18)", color: 'rgba(26,22,18,0.55)', borderRadius: 12, border: '1px solid rgba(26,22,18,0.18)' }}
              >
                Go Solo →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
