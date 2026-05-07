import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function sendOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) setError(error.message)
    else setStep('otp')
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()
    navigate(profile ? '/home' : '/onboarding', { replace: true })
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <h1
        className="italic text-rust mb-12 select-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.5rem, 10vw, 6rem)' }}
      >
        sidequest
      </h1>

      {step === 'email' ? (
        <form onSubmit={sendOtp} className="w-full max-w-sm flex flex-col gap-4">
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
            We'll email you a sign-in code.
          </p>
          {error && <p className="text-rust text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email.includes('@')}
            className="mt-2 border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="w-full max-w-sm flex flex-col gap-4">
          <p className="text-paper/50 text-sm text-center">
            Sent to {email}
          </p>
          <input
            type="tel"
            inputMode="numeric"
            required
            autoFocus
            placeholder="00000000"
            maxLength={8}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="bg-transparent border-b border-paper/40 text-paper placeholder-paper/20 py-2 text-4xl text-center tracking-[0.4em] outline-none focus:border-paper transition-colors"
          />
          {error && <p className="text-rust text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="mt-2 border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('email'); setOtp(''); setError('') }}
            className="text-paper/30 text-xs text-center hover:text-paper/50 transition-colors"
          >
            ← Change email
          </button>
        </form>
      )}
    </div>
  )
}
