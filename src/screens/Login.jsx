import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <h1
        className="italic text-rust mb-12 select-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.5rem, 10vw, 6rem)' }}
      >
        sidequest
      </h1>

      {sent ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-paper text-lg tracking-wide">Check your email ✓</p>
          <p className="text-paper/40 text-sm">Click the link we sent to {email}</p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-paper/30 text-xs hover:text-paper/50 transition-colors"
          >
            ← Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
          <input
            type="email"
            required
            autoFocus
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-transparent border-b border-paper/40 text-paper placeholder-paper/30 py-2 text-base outline-none focus:border-paper transition-colors"
          />
          {error && <p className="text-rust text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.includes('@')}
            className="mt-2 border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send link'}
          </button>
        </form>
      )}
    </div>
  )
}
