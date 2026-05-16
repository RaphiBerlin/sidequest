import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCrewLobby } from '../context/CrewLobbyContext'
import Avatar from './Avatar'

export default function CrewLobbyPill() {
  const { lobby, setLobby } = useCrewLobby()
  const navigate = useNavigate()
  const [invites, setInvites] = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!lobby?.sessionId) {
      setInvites([])
      return
    }

    fetchInvites()

    channelRef.current = supabase
      .channel(`crew-lobby-pill-${lobby.sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'crew_invites',
        filter: `session_id=eq.${lobby.sessionId}`,
      }, fetchInvites)
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [lobby?.sessionId])

  async function fetchInvites() {
    const { data } = await supabase
      .from('crew_invites')
      .select('id, to_user_id, status')
      .eq('session_id', lobby.sessionId)
    const rows = data || []
    setInvites(rows)
    // Auto-clear when all accepted — quest has started
    if (rows.length > 0 && rows.every(r => r.status === 'accepted')) {
      setLobby(null)
    }
  }

  if (!lobby) return null

  const accepted = invites.filter(i => i.status === 'accepted').length
  const total = invites.length || lobby.invitedFriends?.length || 0
  const allAccepted = total > 0 && accepted === total

  return (
    <button
      onClick={() => navigate('/crew-waiting', { state: lobby })}
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 49,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(26,22,18,0.96)',
        border: '1px solid rgba(212,160,42,0.45)',
        borderRadius: 100,
        padding: '8px 14px 8px 10px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'nowrap',
      }}
    >
      {/* Pulsing dot */}
      <span style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: allAccepted ? '#2a8c6e' : '#d4a02a',
          animation: allAccepted ? 'none' : 'crew-pill-pulse 1.6s ease-in-out infinite',
        }} />
        <style>{`
          @keyframes crew-pill-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
          }
        `}</style>
      </span>

      {/* Avatars */}
      {lobby.invitedFriends?.slice(0, 3).map(f => (
        <span key={f.id} style={{ marginRight: -6, flexShrink: 0 }}>
          <Avatar src={f.avatar_url} name={f.name} color={f.avatar_color} size={22} />
        </span>
      ))}

      {/* Label */}
      <span style={{ marginLeft: lobby.invitedFriends?.length ? 8 : 0, fontSize: 10, letterSpacing: '0.18em', color: '#f4ede0' }}>
        {allAccepted
          ? 'CREW READY · TAP TO START'
          : `${accepted}/${total} CREW JOINED`}
      </span>

      <span style={{ fontSize: 10, color: 'rgba(244,237,224,0.4)', marginLeft: 2 }}>›</span>
    </button>
  )
}
