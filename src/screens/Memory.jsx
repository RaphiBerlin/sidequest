import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { completeSession } from '../lib/photos'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import confetti from 'canvas-confetti'

const CAPTION_LIMIT = 150

function formatElapsed(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatStamp(date) {
  return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) +
    ' · ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Animation overlay ──────────────────────────────────────────────────────
// Phases: 'upload' → 'spin' → 'fly' → 'done'

const ANIM_STYLES = `
@keyframes sq-spin {
  0%   { transform: scale(0.6) rotate(0deg);   opacity: 0; }
  20%  { transform: scale(1.05) rotate(120deg); opacity: 1; }
  60%  { transform: scale(1.0) rotate(300deg);  opacity: 1; }
  100% { transform: scale(1.0) rotate(360deg);  opacity: 1; }
}
@keyframes sq-fly {
  0%   { transform: scale(1.0) translate(0px, 0px) rotate(360deg); opacity: 1; }
  60%  { opacity: 1; }
  100% { transform: scale(0.12) translate(var(--fly-x), var(--fly-y)) rotate(540deg); opacity: 0; }
}
@keyframes sq-journal-pop {
  0%   { transform: scale(1);    opacity: 0; }
  30%  { transform: scale(1.6);  opacity: 1; }
  70%  { transform: scale(1.3);  opacity: 1; }
  100% { transform: scale(1);    opacity: 0; }
}
@keyframes sq-card-rise {
  from { transform: translateY(40px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
`

function PhotoAnimation({ src, phase, journalPos }) {
  // Calculate fly delta from screen center to journal tab
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const dx = journalPos.x - cx
  const dy = journalPos.y - cy

  const style =
    phase === 'spin'
      ? { animation: 'sq-spin 0.85s cubic-bezier(0.22,1,0.36,1) forwards' }
      : phase === 'fly'
      ? {
          animation: 'sq-fly 0.6s cubic-bezier(0.55,0,1,0.45) forwards',
          '--fly-x': `${dx / 1}px`,
          '--fly-y': `${dy / 1}px`,
        }
      : { opacity: 0 }

  if (phase === 'upload' || phase === 'done') return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none">
      <div
        className="w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
        style={style}
      >
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
    </div>
  )
}

function JournalFlash({ visible, pos }) {
  if (!visible) return null
  return (
    <div
      className="fixed z-[9999] pointer-events-none flex items-center justify-center"
      style={{
        left: pos.x - 28,
        top: pos.y - 28,
        width: 56,
        height: 56,
        animation: 'sq-journal-pop 0.55s ease-out forwards',
      }}
    >
      <span style={{ fontSize: 32 }}>📖</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Memory() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { user } = useAuth()

  const { mainPhoto, pipPhoto, sessionId, quest, party = [], elapsedSec = 0 } = state || {}

  const [uploading, setUploading] = useState(true)
  const [mainUrl, setMainUrl] = useState(null)
  const [pipUrl, setPipUrl] = useState(null)
  const [generatingCard, setGeneratingCard] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [caption, setCaption] = useState('')
  const [captionSaved, setCaptionSaved] = useState(false)

  // Animation state
  const [phase, setPhase] = useState('upload') // 'upload' | 'spin' | 'fly' | 'done'
  const [journalFlash, setJournalFlash] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)

  const { showToast } = useToast()
  const cardRef = useRef(null)
  const captionTimerRef = useRef(null)
  const now = new Date()
  const hasCompletedRef = useRef(false)

  // Inject animation keyframes once
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'sq-anim'
    style.textContent = ANIM_STYLES
    document.head.appendChild(style)
    return () => document.getElementById('sq-anim')?.remove()
  }, [])

  // Journal tab position (3rd of 4 tabs, bottom bar ~56px tall)
  const journalPos = {
    x: window.innerWidth * 0.625,
    y: window.innerHeight - 28,
  }

  // Upload
  useEffect(() => {
    if (hasCompletedRef.current) return
    if (!user) return
    hasCompletedRef.current = true

    if (!sessionId) { setUploading(false); return }

    const mainBlob = mainPhoto instanceof Blob ? mainPhoto : null
    const pipBlob  = pipPhoto instanceof Blob  ? pipPhoto  : null
    completeSession({ sessionId, userId: user.id, mainPhoto: mainBlob, pipPhoto: pipBlob, elapsedSec })
      .then(({ mainUrl: mu, pipUrl: pu }) => { setMainUrl(mu); setPipUrl(pu) })
      .catch(() => showToast("Photo didn't save — quest still complete", 'warning'))
      .finally(() => setUploading(false))
  }, [user])

  // Start animation once upload finishes and preview is ready
  const mainPreview = mainUrl || (mainPhoto instanceof Blob ? URL.createObjectURL(mainPhoto) : null)
  const pipPreview  = pipUrl  || (pipPhoto  instanceof Blob ? URL.createObjectURL(pipPhoto)  : null)

  useEffect(() => {
    if (uploading) return
    if (!mainPreview) {
      // No photo — skip animation, go straight to card
      setPhase('done')
      setCardVisible(true)
      navigator.vibrate?.([50, 30, 80])
      return
    }

    // Kick off the sequence
    setPhase('spin')

    const t1 = setTimeout(() => setPhase('fly'), 900)

    const t2 = setTimeout(() => {
      setJournalFlash(true)
      setTimeout(() => setJournalFlash(false), 550)
    }, 1420)

    const t3 = setTimeout(() => {
      setPhase('done')
      setCardVisible(true)
      navigator.vibrate?.([50, 30, 80])
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#c44829', '#d4a02a', '#f4ede0', '#2ad47a', '#ffffff'],
        disableForReducedMotion: true,
      })
    }, 1650)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [uploading, !!mainPreview])

  function handleCaptionChange(e) {
    const val = e.target.value.slice(0, CAPTION_LIMIT)
    setCaption(val)
    setCaptionSaved(false)
    clearTimeout(captionTimerRef.current)
    captionTimerRef.current = setTimeout(() => saveCaption(val), 800)
  }

  async function saveCaption(text) {
    if (!sessionId) return
    await supabase.from('quest_sessions').update({ caption: text || null }).eq('id', sessionId)
    setCaptionSaved(true)
  }

  async function togglePublic() {
    const next = !isPublic
    setIsPublic(next)
    if (sessionId) {
      await supabase.from('quest_sessions').update({ is_public: next }).eq('id', sessionId)
    }
  }

  async function addFriend(friendId) {
    if (!user) return
    await supabase.from('friendships').insert({ user_id: user.id, friend_id: friendId, status: 'accepted' })
  }

  async function saveCard() {
    setGeneratingCard(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext('2d')

      if (!ctx.roundRect) {
        ctx.roundRect = function(x, y, w, h, r) {
          this.moveTo(x + r, y)
          this.lineTo(x + w - r, y)
          this.quadraticCurveTo(x + w, y, x + w, y + r)
          this.lineTo(x + w, y + h - r)
          this.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
          this.lineTo(x + r, y + h)
          this.quadraticCurveTo(x, y + h, x, y + h - r)
          this.lineTo(x, y + r)
          this.quadraticCurveTo(x, y, x + r, y)
          this.closePath()
        }
      }

      ctx.fillStyle = '#1a1612'
      ctx.fillRect(0, 0, 1080, 1920)

      ctx.fillStyle = 'rgba(244,237,224,0.03)'
      for (let i = 0; i < 8000; i++) {
        ctx.fillRect(Math.random() * 1080, Math.random() * 1920, 1, 1)
      }

      ctx.fillStyle = '#c44829'
      ctx.font = 'italic bold 48px serif'
      ctx.fillText('sidequest', 60, 78)

      const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
      ctx.fillStyle = 'rgba(244,237,224,0.6)'
      ctx.font = '24px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(dateStr, 1020, 78)
      ctx.textAlign = 'left'

      const photoX = 40, photoY = 140, photoW = 1000, photoH = 1000

      if (mainUrl || mainPhoto) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = mainUrl || URL.createObjectURL(mainPhoto) })
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(photoX, photoY, photoW, photoH, 32)
        ctx.clip()
        ctx.drawImage(img, photoX, photoY, photoW, photoH)
        ctx.restore()

        if (pipUrl || pipPhoto) {
          const pipImg = new Image()
          pipImg.crossOrigin = 'anonymous'
          await new Promise((resolve) => { pipImg.onload = resolve; pipImg.onerror = resolve; pipImg.src = pipUrl || URL.createObjectURL(pipPhoto) })
          const pipW = 200, pipH = 280
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(photoX + 20, photoY + 20, pipW, pipH, 20)
          ctx.clip()
          ctx.drawImage(pipImg, photoX + 20, photoY + 20, pipW, pipH)
          ctx.restore()
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6
          ctx.beginPath()
          ctx.roundRect(photoX + 20, photoY + 20, pipW, pipH, 20)
          ctx.stroke()
        }

        const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const stampText = `${dateStr} · ${ts}`
        ctx.fillStyle = 'rgba(26,22,18,0.75)'
        const stampW = ctx.measureText(stampText).width + 24
        ctx.fillRect(photoX + photoW - 20 - stampW, photoY + photoH - 52, stampW, 36)
        ctx.fillStyle = '#f4ede0'; ctx.font = '20px monospace'; ctx.textAlign = 'right'
        ctx.fillText(stampText, photoX + photoW - 20 - 12 + stampW, photoY + photoH - 28)
        ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = 'rgba(244,237,224,0.1)'
        ctx.beginPath()
        ctx.roundRect(photoX, photoY, photoW, photoH, 32)
        ctx.fill()
      }

      ctx.fillStyle = '#f4ede0'; ctx.font = 'italic bold 52px serif'
      ctx.fillText(quest?.title || 'Quest Complete', 60, 1220)

      const elapsed = elapsedSec || 0
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
      const ss = String(elapsed % 60).padStart(2, '0')
      ctx.font = '28px monospace'; ctx.fillStyle = 'rgba(244,237,224,0.7)'
      ctx.fillText(`⏱ ${mm}:${ss}  👥 ${party?.length > 0 ? `+${party.length}` : 'SOLO'}  ⭐ +${quest?.xp || 0} XP`, 60, 1320)

      ctx.fillStyle = 'rgba(26,22,18,0.9)'
      ctx.fillRect(0, 1840, 1080, 80)
      ctx.fillStyle = '#d4a02a'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'
      ctx.fillText('★ COMPLETED A SIDE / QUEST', 540, 1888)
      ctx.textAlign = 'left'

      canvas.toBlob(async (blob) => {
        setGeneratingCard(false)
        const file = new File([blob], 'sidequest-memory.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'Sidequest', text: quest?.title || 'Quest Complete' }); showToast('Card saved!', 'success'); return } catch {}
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'sidequest-memory.png'; a.click()
        URL.revokeObjectURL(url)
        showToast('Card saved!', 'success')
      }, 'image/png')
    } catch { setGeneratingCard(false) }
  }

  const newConnections = party.filter(p => p.tier === 'fof' || p.tier === 'open')

  return (
    <>
      {/* Dark backdrop during animation */}
      {phase !== 'done' && phase !== 'upload' && (
        <div className="fixed inset-0 z-[9997] bg-dark" />
      )}

      {/* Upload loading screen */}
      {phase === 'upload' && (
        <div className="fixed inset-0 z-[9997] bg-dark flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
          <p className="text-paper/40 text-xs font-mono tracking-widest uppercase">Saving your quest…</p>
        </div>
      )}

      {/* Spinning / flying photo */}
      <PhotoAnimation src={mainPreview} phase={phase} journalPos={journalPos} />

      {/* Journal tab flash */}
      <JournalFlash visible={journalFlash} pos={journalPos} />

      {/* Memory card — slides up after animation */}
      {phase === 'done' && (
        <div
          className="min-h-screen bg-paper flex flex-col px-5 py-12 gap-6"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            animation: cardVisible ? 'sq-card-rise 0.5s cubic-bezier(0.22,1,0.36,1) forwards' : 'none',
          }}
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-rust italic text-4xl" style={{ fontFamily: "'Fraunces', serif" }}>
              Quest complete.
            </h1>
            <p className="text-gold text-xs mt-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ★ +{quest?.xp || 100} XP EARNED
            </p>
          </div>

          {/* Memory card */}
          <div ref={cardRef} className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="relative h-60 bg-dark/10">
              {mainPreview ? (
                <img src={mainPreview} alt="quest photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-dark/20 text-5xl">◐</span>
                </div>
              )}
              {pipPreview && (
                <div className="absolute top-2 left-2 w-16 h-24 rounded-lg border-2 border-white overflow-hidden">
                  <img src={pipPreview} alt="PiP" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-dark/70 text-paper text-xs px-2 py-1 rounded-full" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatStamp(now)}
              </div>
            </div>

            <div className="p-4">
              <h2 className="italic text-dark text-xl mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
                {quest?.title || 'Quest Complete'}
              </h2>
              <div className="flex gap-2">
                {[
                  { label: 'TIME',   value: formatElapsed(elapsedSec) },
                  { label: 'PARTY',  value: `${party.length + 1}` },
                  { label: 'STREAK', value: '+1' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex-1 border border-dark/10 rounded-lg p-2 text-center">
                    <p className="text-dark/40 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
                    <p className="text-dark font-bold text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Public feed toggle */}
          <div className="bg-white rounded-xl px-4 py-3 border border-dark/5 flex items-center justify-between gap-4">
            <div>
              <p className="text-dark text-sm font-medium">Share to public feed</p>
              <p className="text-dark/40 text-xs mt-0.5">Visible to everyone on Sidequest</p>
            </div>
            <button
              onClick={togglePublic}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isPublic ? 'bg-rust' : 'bg-dark/20'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* New connections */}
          {newConnections.map(p => (
            <div key={p.userId} className="bg-white rounded-xl p-4 border border-gold/20">
              <p className="text-gold text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>NEW CONNECTION</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark font-medium">{p.name}</p>
                  {p.viaName && <p className="text-dark/40 text-xs">via {p.viaName}</p>}
                </div>
                <button
                  onClick={() => addFriend(p.userId)}
                  className="text-rust text-sm border border-rust/30 px-3 py-1 rounded-full hover:bg-rust hover:text-white transition-colors"
                >
                  + Add friend
                </button>
              </div>
            </div>
          ))}

          {/* Caption */}
          <div className="bg-white rounded-xl border border-dark/5 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-dark/40 text-xs tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Add a note
              </p>
              <p className="text-dark/25 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {captionSaved ? '✓ saved' : `${caption.length}/${CAPTION_LIMIT}`}
              </p>
            </div>
            <textarea
              value={caption}
              onChange={handleCaptionChange}
              onBlur={() => { clearTimeout(captionTimerRef.current); saveCaption(caption) }}
              placeholder="What was this quest about for you?"
              rows={3}
              className="w-full bg-transparent text-dark text-sm leading-relaxed outline-none resize-none placeholder-dark/25"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={saveCard}
              disabled={generatingCard}
              className="flex-1 border border-dark/20 text-dark text-sm tracking-widest uppercase py-3 hover:bg-dark/5 transition-colors disabled:opacity-40"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {generatingCard ? 'Generating…' : 'Save card'}
            </button>
            <button
              onClick={() => navigate('/home')}
              className="flex-1 bg-dark text-paper text-sm tracking-widest uppercase py-3"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Done
            </button>
          </div>

          {/* Soft nudge to see feed */}
          <button
            onClick={() => navigate('/feed')}
            className="text-center text-dark/30 text-xs hover:text-dark/60 transition-colors pb-4"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            See everyone's submissions →
          </button>
        </div>
      )}
    </>
  )
}
