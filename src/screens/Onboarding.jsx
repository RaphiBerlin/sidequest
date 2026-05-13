import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { contactsSupported, getContactPhones, hashContactPhones } from '../lib/contacts'
import { checkText } from '../lib/moderation'
import { getInviteLink } from '../lib/invites'
import Avatar from '../components/Avatar'

const PALETTE = [
  '#c44829', '#d4a02a', '#2a6dd4', '#2ad47a',
  '#9b2ad4', '#d42a7a', '#1a8080', '#e0743a',
]

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

async function resizeAvatar(file, size = 400) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

// Step indicator
function Steps({ current }) {
  const steps = ['name', 'photo', 'phone', 'contacts', 'invite']
  const idx = steps.indexOf(current)
  return (
    <div className="flex gap-1.5 mb-10">
      {steps.map((s, i) => (
        <div
          key={s}
          className="h-0.5 flex-1 rounded-full transition-colors"
          style={{ backgroundColor: i <= idx ? '#c44829' : 'rgba(244,237,224,0.2)' }}
        />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // step: 'name' | 'photo' | 'phone' | 'contacts' | 'invite'
  const [step, setStep] = useState('name')
  const [name, setName] = useState('')
  const [avatarColor] = useState(() => PALETTE[Math.floor(Math.random() * PALETTE.length)])
  const [avatarPreview, setAvatarPreview] = useState(null) // local blob URL for preview
  const [avatarBlob, setAvatarBlob] = useState(null)       // compressed blob to upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [phoneDigits, setPhoneDigits] = useState('')
  const [loading, setLoading] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [error, setError] = useState(null)

  // ── Step 1: Name ────────────────────────────────────────────────────────
  async function handleName(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const banned = await checkText(name.trim())
    if (banned) {
      setError("That name contains a word that isn't allowed. Please choose a different name.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name: name.trim(),
      avatar_color: avatarColor,
    })

    setLoading(false)
    if (error) { setError(error.message); return }

    // Resolve pending invite link
    const pendingCode = localStorage.getItem('sq_invite_code')
    if (pendingCode) {
      const { resolveInvite, createFriendship } = await import('../lib/invites')
      const inviter = await resolveInvite(pendingCode)
      if (inviter && inviter.id !== user.id) await createFriendship(user.id, inviter.id)
      localStorage.removeItem('sq_invite_code')
    }

    setStep('photo')
  }

  // ── Step 2: Photo ───────────────────────────────────────────────────────
  async function handlePhotoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const blob = await resizeAvatar(file)
    setAvatarBlob(blob)
    setAvatarPreview(URL.createObjectURL(blob))
    setUploadingPhoto(false)
    e.target.value = ''
  }

  async function handlePhotoNext() {
    if (avatarBlob) {
      // Upload in background — don't block the user
      const path = `avatars/${user.id}.jpg`
      supabase.storage
        .from('quest-photos')
        .upload(path, avatarBlob, { contentType: 'image/jpeg', upsert: true })
        .then(({ error }) => {
          if (!error) {
            const { data } = supabase.storage.from('quest-photos').getPublicUrl(path)
            supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id)
          }
        })
    }
    setStep('phone')
  }

  // ── Step 3: Phone ───────────────────────────────────────────────────────
  async function handlePhone(e) {
    e?.preventDefault()
    if (phoneDigits.length >= 10) {
      setLoading(true)
      const normalized = normalizePhone(phoneDigits)
      if (normalized) {
        const hash = await sha256hex(normalized)
        await supabase.from('users').update({ phone_hash: hash }).eq('id', user.id)
        await supabase.rpc('create_auto_friendships')
      }
      setLoading(false)
    }
    setStep('contacts')
  }

  // ── Step 4: Contacts ────────────────────────────────────────────────────
  async function handleContacts() {
    setContactsLoading(true)
    try {
      const phones = await getContactPhones()
      if (phones.length > 0) {
        const hashes = await hashContactPhones(phones)
        await supabase.rpc('store_contact_hashes', { hashes })
        await supabase.rpc('create_auto_friendships')
      }
    } catch {
      // AbortError = user cancelled
    }
    setContactsLoading(false)
    setStep('invite')
  }

  // ── Step 5: Invite ──────────────────────────────────────────────────────
  async function shareInvite() {
    const link = await getInviteLink(user.id)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Sidequest', text: 'Come quest with me!', url: link })
        return
      } catch {}
    }
    await navigator.clipboard.writeText(link)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2500)
  }

  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-6">
      <h1
        className="italic text-rust mb-8 select-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
      >
        sidequest
      </h1>

      <div className="w-full max-w-sm">
        <Steps current={step} />

        {/* ── Step 1: Name ── */}
        {step === 'name' && (
          <form onSubmit={handleName} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label
                className="text-paper/40 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
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
              className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors disabled:opacity-40"
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {/* ── Step 2: Photo ── */}
        {step === 'photo' && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col gap-1 text-center">
              <p
                className="text-paper text-xl leading-snug"
                style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
              >
                Add a profile photo
              </p>
              <p className="text-paper/40 text-sm">
                This is how your friends will recognise you.
              </p>
            </div>

            {/* Avatar preview with tap-to-upload */}
            <div className="relative">
              <Avatar
                src={avatarPreview}
                name={name}
                color={avatarColor}
                size={112}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-rust text-paper flex items-center justify-center shadow-lg hover:bg-rust/80 transition-colors disabled:opacity-40 focus:outline-none"
                aria-label="Choose photo"
              >
                {uploadingPhoto
                  ? <span className="text-xs font-mono">…</span>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                }
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFile}
            />

            {avatarPreview && (
              <p className="text-paper/40 text-xs font-mono">Looking good ✓</p>
            )}

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handlePhotoNext}
                className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors w-full"
              >
                {avatarPreview ? 'Continue' : 'Continue'}
              </button>
              {!avatarPreview && (
                <button
                  onClick={() => setStep('phone')}
                  className="text-paper/30 text-xs text-center hover:text-paper/50 transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Phone ── */}
        {step === 'phone' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p
                className="text-paper text-xl leading-snug"
                style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
              >
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

        {/* ── Step 4: Contacts ── */}
        {step === 'contacts' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p
                className="text-paper text-xl leading-snug"
                style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
              >
                Find your friends
              </p>
              <p className="text-paper/50 text-sm leading-relaxed">
                We'll check which of your contacts are already on Sidequest so you can connect instantly.
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
                  onClick={() => setStep('invite')}
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
                  onClick={() => setStep('invite')}
                  className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Invite friends ── */}
        {step === 'invite' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p
                className="text-paper text-xl leading-snug"
                style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
              >
                Bring your people
              </p>
              <p className="text-paper/50 text-sm leading-relaxed">
                Sidequest is better with friends. Send them a link — they'll join in seconds.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={shareInvite}
                className="border border-rust text-rust py-2 px-6 text-sm tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors"
              >
                {inviteCopied ? '✓ Link copied!' : '↗ Invite friends'}
              </button>
              <button
                onClick={() => navigate('/home', { replace: true })}
                className="text-paper/30 text-xs text-center hover:text-paper/50 transition-colors"
              >
                {inviteCopied ? 'Done' : 'Skip for now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
