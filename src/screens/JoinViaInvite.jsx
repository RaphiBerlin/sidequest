import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { resolveInvite } from '../lib/invites'

export default function JoinViaInvite() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [inviter, setInviter] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    resolveInvite(code).then(data => {
      setInviter(data)
      setLoading(false)
      // Store code for after signup
      if (data) localStorage.setItem('sq_invite_code', code)
    })
  }, [code])

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
    </div>
  )

  if (!inviter) return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-8 text-center gap-4">
      <p className="text-paper/60 italic text-xl" style={{ fontFamily: "'Fraunces', serif" }}>Invalid invite link.</p>
      <button onClick={() => navigate('/')} className="text-rust text-sm font-mono tracking-widest">← Back</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-8 text-center gap-6" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      <h1 className="text-rust italic text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>side/quest</h1>
      <p className="text-paper/80 text-lg">
        <span className="text-paper font-medium">{inviter.name}</span> invited you to Side / Quest
      </p>
      <p className="text-paper/40 text-sm">The daily outdoor quest app for friends.</p>
      <button
        onClick={() => navigate('/')}
        className="bg-rust text-dark text-sm font-mono tracking-widest uppercase px-8 py-3 rounded-lg w-full max-w-xs"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Join and connect with {inviter.name} →
      </button>
    </div>
  )
}
