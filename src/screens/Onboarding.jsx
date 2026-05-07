import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleContinue(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name: name.trim(),
      avatar_color: 'C44829',
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      // Check for pending invite code
      const pendingCode = localStorage.getItem('sq_invite_code')
      if (pendingCode) {
        const { resolveInvite, createFriendship } = await import('../lib/invites')
        const inviter = await resolveInvite(pendingCode)
        if (inviter && inviter.id !== user.id) {
          await createFriendship(user.id, inviter.id)
        }
        localStorage.removeItem('sq_invite_code')
      }
      navigate('/home', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <h1
        className="italic text-rust mb-16 select-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem, 8vw, 5rem)' }}
      >
        sidequest
      </h1>

      <form onSubmit={handleContinue} className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-paper/40 text-xs tracking-widest uppercase">
            What should we call you?
          </label>
          <input
            type="text"
            required
            maxLength={20}
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border-b border-paper/40 text-paper placeholder-paper/20 py-2 text-lg outline-none focus:border-paper transition-colors"
          />
        </div>

        {error && <p className="text-rust text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || name.trim().length === 0}
          className="mt-2 border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
