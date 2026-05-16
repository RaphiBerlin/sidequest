import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Redirect already-authenticated users straight to home
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/home', { replace: true })
    })
  }, [])

  async function signInWithGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

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

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(244,237,224,0.12)' }} />
            <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(244,237,224,0.25)' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(244,237,224,0.12)' }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex items-center justify-center gap-3 w-full py-2 px-6 border text-sm tracking-wide transition-colors hover:bg-paper/5"
            style={{ borderColor: 'rgba(244,237,224,0.2)', color: 'rgba(244,237,224,0.6)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
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
