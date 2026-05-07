import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { contactsSupported, getContactPhones, hashContactPhones } from '../lib/contacts'

async function sha256hex(str) {
  const data = new TextEncoder().encode(str)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length > 7) return '+' + digits
  return null
}

function formatDisplay(digits) {
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('name') // 'name' | 'phone' | 'contacts'
  const [name, setName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [loading, setLoading] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleName(e) {
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
    if (error) { setError(error.message); return }

    // Check for pending invite
    const pendingCode = localStorage.getItem('sq_invite_code')
    if (pendingCode) {
      const { resolveInvite, createFriendship } = await import('../lib/invites')
      const inviter = await resolveInvite(pendingCode)
      if (inviter && inviter.id !== user.id) {
        await createFriendship(user.id, inviter.id)
      }
      localStorage.removeItem('sq_invite_code')
    }

    setStep('phone')
  }

  async function handlePhone(e) {
    e?.preventDefault()
    if (phoneDigits.length >= 10) {
      setLoading(true)
      const normalized = normalizePhone(phoneDigits)
      if (normalized) {
        const hash = await sha256hex(normalized)
        await supabase.from('users').update({ phone_hash: hash }).eq('id', user.id)
        // Auto-friend anyone who already has this number in their contacts
        await supabase.rpc('create_auto_friendships')
      }
      setLoading(false)
    }
    setStep('contacts')
  }

  async function handleContacts() {
    setContactsLoading(true)
    try {
      const phones = await getContactPhones()
      if (phones.length > 0) {
        const hashes = await hashContactPhones(phones)
        await supabase.rpc('store_contact_hashes', { hashes })
        // Auto-friend anyone whose number matches
        await supabase.rpc('create_auto_friendships')
      }
    } catch (e) {
      // AbortError = user cancelled, that's fine
    }
    setContactsLoading(false)
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <h1
        className="italic text-rust mb-12 select-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem, 8vw, 5rem)' }}
      >
        sidequest
      </h1>

      {/* Step 1: Name */}
      {step === 'name' && (
        <form onSubmit={handleName} className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-paper/40 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              What should we call you?
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={20}
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
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
      )}

      {/* Step 2: Phone number */}
      {step === 'phone' && (
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-paper text-xl leading-snug"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>
              Add your number so friends can find you
            </p>
            <p className="text-paper/40 text-sm">
              Your number is hashed — we never store it in plain text.
            </p>
          </div>
          <form onSubmit={handlePhone} className="flex flex-col gap-4">
            <div className="flex items-end gap-2 border-b border-paper/40 pb-2 focus-within:border-paper transition-colors">
              <span className="text-paper/40 text-base pb-0.5 select-none flex-shrink-0">+1</span>
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                placeholder="(555) 000-0000"
                value={formatDisplay(phoneDigits)}
                onChange={e => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="flex-1 bg-transparent text-paper placeholder-paper/30 text-base outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || phoneDigits.length < 10}
              className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>
          <button
            onClick={() => setStep('contacts')}
            className="text-paper/30 text-xs text-center hover:text-paper/50 transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step 3: Contacts */}
      {step === 'contacts' && (
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-paper text-xl leading-snug"
              style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>
              Find your friends
            </p>
            <p className="text-paper/50 text-sm leading-relaxed">
              We'll check which of your contacts are already on Sidequest, and show you friends-of-friends so you can build your network fast.
            </p>
            <p className="text-paper/30 text-xs">
              Contact data is hashed on your device — raw numbers are never sent.
            </p>
          </div>

          {contactsSupported() ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleContacts}
                disabled={contactsLoading}
                className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
              >
                {contactsLoading ? 'Scanning…' : 'Allow contacts'}
              </button>
              <button
                onClick={() => navigate('/home', { replace: true })}
                className="text-paper/30 text-xs text-center hover:text-paper/50 transition-colors"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-paper/30 text-xs">
                Contact matching is available on mobile. You can add friends from the Friends tab.
              </p>
              <button
                onClick={() => navigate('/home', { replace: true })}
                className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors"
              >
                Get started
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
