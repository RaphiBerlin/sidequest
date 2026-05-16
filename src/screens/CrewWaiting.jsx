import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import { useCrewLobby } from '../context/CrewLobbyContext'

const STATUS_STYLE = {
  pending:  { bg: 'rgba(212,160,42,0.12)',  border: 'rgba(212,160,42,0.3)',  color: '#a07a10', label: '⏳ PENDING' },
  accepted: { bg: 'rgba(42,140,110,0.12)',  border: 'rgba(42,140,110,0.3)',  color: '#2a8c6e', label: '✓ JOINED'  },
  declined: { bg: 'rgba(196,72,41,0.10)',   border: 'rgba(196,72,41,0.25)', color: '#c44829', label: '✗ DECLINED' },
}

export default function CrewWaiting() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { activeQuest, sessionId, invitedFriends = [] } = state ?? {}
  const [invites, setInvites] = useState([])
  const channelRef = useRef(null)
  const proceededRef = useRef(false)
  const { setLobby } = useCrewLobby()

  // Register with global context so the pill shows when navigating away
  useEffect(() => {
    if (!sessionId) return
    setLobby({ sessionId, activeQuest, invitedFriends })
    return () => {} // context persists on unmount — pill takes over
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    fetchInvites()

    channelRef.current = supabase
      .channel(`crew-waiting-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'crew_invites',
        filter: `session_id=eq.${sessionId}`,
      }, () => fetchInvites())
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [sessionId])

  async function fetchInvites() {
    const { data } = await supabase
      .from('crew_invites')
      .select('id, to_user_id, status')
      .eq('session_id', sessionId)
    const rows = data || []
    setInvites(rows)
    // Auto-proceed when every invite is accepted
    if (rows.length > 0 && rows.every(r => r.status === 'accepted') && !proceededRef.current) {
      proceededRef.current = true
      navigate('/active-quest', { state: { activeQuest } })
    }
  }

  function proceed() {
    proceededRef.current = true
    setLobby(null) // dismiss pill — quest is starting
    navigate('/active-quest', { state: { activeQuest } })
  }

  function goBack() {
    // Lobby context already set — pill will appear above tab bar
    navigate('/home')
  }

  function getStatus(friendId) {
    return invites.find(i => i.to_user_id === friendId)?.status ?? 'pending'
  }

  const allAccepted = invites.length > 0 && invites.every(i => i.status === 'accepted')
  const quest = activeQuest?.quest

  if (!activeQuest) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-paper/40 text-sm font-mono">No quest data.</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-dark flex flex-col items-center px-5 pt-14 pb-12"
      style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
    >
      {/* Back button */}
      <button
        onClick={goBack}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'rgba(244,237,224,0.35)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 2px',
        }}
      >
        ← HOME
      </button>

      {/* Status label */}
      <p
        className="text-xs tracking-[0.3em] uppercase mb-10"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: allAccepted ? '#2a8c6e' : '#d4a02a' }}
      >
        {allAccepted ? '▲ CREW READY' : '⏳ WAITING FOR CREW'}
      </p>

      {/* Quest card */}
      <div
        className="w-full max-w-sm bg-paper rounded-2xl shadow-xl p-5 mb-10"
        style={{ transform: 'rotate(-1.5deg)' }}
      >
        <div className="absolute -top-3 left-4 bg-rust text-dark text-xs font-bold px-3 py-1 tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          TODAY'S QUEST
        </div>
        <h2 className="text-dark italic text-2xl leading-tight mt-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
          {quest?.title}
        </h2>
        {quest?.duration_min && (
          <p className="text-dark/40 text-xs mt-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {quest.duration_min} MIN
          </p>
        )}
      </div>

      {/* Crew list */}
      <div className="w-full max-w-sm mb-10">
        <p className="text-paper/30 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Your Crew
        </p>
        <div className="flex flex-col gap-2">
          {invitedFriends.map(f => {
            const status = getStatus(f.id)
            const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <Avatar src={f.avatar_url} name={f.name} color={f.avatar_color} size={36} />
                <p className="flex-1 text-sm font-medium" style={{ color: '#f4ede0' }}>{f.name}</p>
                <span
                  className="text-[10px] tracking-widest"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: s.color }}
                >
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={proceed}
          className="w-full py-4 text-sm tracking-widest uppercase font-bold transition-all"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: allAccepted ? '#c44829' : 'rgba(196,72,41,0.25)',
            color: '#f4ede0',
            borderRadius: 12,
          }}
        >
          {allAccepted ? 'Start Quest →' : 'Start Anyway →'}
        </button>
        {!allAccepted && (
          <p className="text-center text-paper/25 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            You'll auto-start when all crew joins
          </p>
        )}
      </div>
    </div>
  )
}
