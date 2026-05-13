import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function sendLink(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <div className="mb-10 select-none text-center" style={{ fontFamily: "'Fraunces', serif" }}>
        <span
          style={{
            fontSize: 'clamp(2.8rem, 12vw, 5rem)',
            fontStyle: 'italic',
            fontWeight: 300,
            color: '#c44829',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          sidequest
        </span>
      </div>

      {!sent ? (
        <form onSubmit={sendLink} className="w-full max-w-sm flex flex-col gap-4">
          <input
            type="email"
            required
            autoFocus
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-transparent border-b border-paper/40 text-paper placeholder-paper/30 py-2 text-base outline-none focus:border-paper transition-colors"
          />
          <p className="text-paper/30 text-xs tracking-wide">
            We'll email you a link — no password needed.
          </p>
          {error && <p className="text-rust text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.includes('@')}
            className="mt-2 border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Continue'}
          </button>
        </form>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
          <p
            className="text-paper text-2xl leading-snug"
            style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
          >
            Check your inbox
          </p>
          <p className="text-paper/50 text-sm leading-relaxed">
            We sent a sign-in link to<br />
            <span className="text-paper/80">{email}</span>
          </p>
          <p className="text-paper/25 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Click the link in the email to continue.
          </p>
          <button
            onClick={() => { setSent(false); setError('') }}
            className="text-paper/30 text-xs hover:text-paper/50 transition-colors mt-2"
          >
            ← Use a different email
          </button>
        </div>
      )}
    </div>
  )
}
