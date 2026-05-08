import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useReactions } from '../hooks/useReactions'
import { completeSession } from '../lib/photos'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

const EMOJIS = ['🔥', '✨', '😂', '🙌', '🥲']
const AUTO_EMOJIS = ['🔥', '✨', '😂', '🙌', '🥲', '⚡', '🎯', '💫']

function formatElapsed(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatStamp(date) {
  return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) +
    ' · ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Memory() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { user } = useAuth()

  const { mainPhoto, pipPhoto, sessionId, quest, party = [], elapsedSec = 0 } = state || {}

  const [uploading, setUploading] = useState(true)
  const [mainUrl, setMainUrl] = useState(null)
  const [pipUrl, setPipUrl] = useState(null)
  const [generatingCard, setGeneratingCard] = useState(false)

  const { showToast } = useToast()
  const { myReactions, toggleReaction, grouped } = useReactions(sessionId, user?.id)
  const cardRef = useRef(null)
  const now = new Date()

  // Upload photos on mount
  useEffect(() => {
    if (!sessionId || !user) { setUploading(false); return }
    const mainBlob = mainPhoto instanceof Blob ? mainPhoto : null
    const pipBlob = pipPhoto instanceof Blob ? pipPhoto : null
    completeSession({ sessionId, userId: user.id, mainPhoto: mainBlob, pipPhoto: pipBlob, elapsedSec })
      .then(({ mainUrl: mu, pipUrl: pu }) => {
        setMainUrl(mu)
        setPipUrl(pu)
      })
      .catch((err) => {
        console.error(err)
        showToast("Photo didn't save — quest still complete", 'warning')
      })
      .finally(() => setUploading(false))
  }, [])

  async function addFriend(friendId) {
    if (!user) return
    await supabase.from('friendships').insert({ user_id: user.id, friend_id: friendId, status: 'accepted' })
  }

  // Stories-format canvas card download (1080×1920 / 9:16)
  async function saveCard() {
    setGeneratingCard(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext('2d')

      // roundRect polyfill for browsers that don't support it
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

      // Background: dark ink
      ctx.fillStyle = '#1a1612'
      ctx.fillRect(0, 0, 1080, 1920)

      // Subtle paper grain texture (random semi-transparent dots)
      ctx.fillStyle = 'rgba(244,237,224,0.03)'
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 1080
        const y = Math.random() * 1920
        ctx.fillRect(x, y, 1, 1)
      }

      // Header bar (top 120px)
      // Logo: "sidequest" left
      ctx.fillStyle = '#c44829'
      ctx.font = 'italic bold 48px serif'
      ctx.fillText('sidequest', 60, 78)

      // Date right
      const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
      ctx.fillStyle = 'rgba(244,237,224,0.6)'
      ctx.font = '24px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(dateStr, 1020, 78)
      ctx.textAlign = 'left'

      // Photo area: centered, 1000×1000px, rounded corners 32px, starts at y=140
      const photoX = 40, photoY = 140, photoW = 1000, photoH = 1000

      if (mainUrl || mainPhoto) {
        // Load the image
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
          img.src = mainUrl || URL.createObjectURL(mainPhoto)
        })

        // Rounded clip
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(photoX, photoY, photoW, photoH, 32)
        ctx.clip()
        ctx.drawImage(img, photoX, photoY, photoW, photoH)
        ctx.restore()

        // PiP overlay (if exists)
        if (pipUrl || pipPhoto) {
          const pipImg = new Image()
          pipImg.crossOrigin = 'anonymous'
          await new Promise((resolve) => {
            pipImg.onload = resolve
            pipImg.onerror = resolve
            pipImg.src = pipUrl || URL.createObjectURL(pipPhoto)
          })
          const pipW = 200, pipH = 280
          const pipX = photoX + 20, pipY2 = photoY + 20
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(pipX, pipY2, pipW, pipH, 20)
          ctx.clip()
          ctx.drawImage(pipImg, pipX, pipY2, pipW, pipH)
          ctx.restore()
          // White border around PiP
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.roundRect(pipX, pipY2, pipW, pipH, 20)
          ctx.stroke()
        }

        // Timestamp stamp bottom-right of photo
        const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const stampText = `${dateStr} · ${ts}`
        const stampX = photoX + photoW - 20
        const stampY = photoY + photoH - 20
        ctx.fillStyle = 'rgba(26,22,18,0.75)'
        const stampW = ctx.measureText(stampText).width + 24
        ctx.fillRect(stampX - stampW, stampY - 32, stampW, 36)
        ctx.fillStyle = '#f4ede0'
        ctx.font = '20px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(stampText, stampX - 12, stampY - 8)
        ctx.textAlign = 'left'
      } else {
        // Placeholder
        ctx.fillStyle = 'rgba(244,237,224,0.1)'
        ctx.beginPath()
        ctx.roundRect(photoX, photoY, photoW, photoH, 32)
        ctx.fill()
      }

      // Quest title (below photo, y=1180)
      ctx.fillStyle = '#f4ede0'
      ctx.font = 'italic bold 52px serif'
      ctx.fillText(quest?.title || 'Quest Complete', 60, 1220)

      // Stats row (y=1300): TIME · PARTY · XP
      const elapsed = elapsedSec || 0
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
      const ss = String(elapsed % 60).padStart(2, '0')
      const timeStr = `${mm}:${ss}`
      const partyStr = party?.length > 0 ? `+${party.length}` : 'SOLO'
      const xpStr = `+${quest?.xp || 0} XP`

      ctx.font = '28px monospace'
      ctx.fillStyle = 'rgba(244,237,224,0.7)'
      ctx.fillText(`⏱ ${timeStr}  👥 ${partyStr}  ⭐ ${xpStr}`, 60, 1320)

      // Footer bar (bottom 80px, y=1840)
      ctx.fillStyle = 'rgba(26,22,18,0.9)'
      ctx.fillRect(0, 1840, 1080, 80)
      ctx.fillStyle = '#d4a02a'
      ctx.font = 'bold 26px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('★ COMPLETED A SIDE / QUEST', 540, 1888)
      ctx.textAlign = 'left'

      // Download or share
      canvas.toBlob(async (blob) => {
        setGeneratingCard(false)
        const file = new File([blob], 'sidequest-memory.png', { type: 'image/png' })

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Sidequest', text: quest?.title || 'Quest Complete' })
            showToast('Card saved!', 'success')
            return
          } catch (e) {
            // fallback to download
          }
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'sidequest-memory.png'
        a.click()
        URL.revokeObjectURL(url)
        showToast('Card saved!', 'success')
      }, 'image/png')
    } catch { setGeneratingCard(false) }
  }

  // Local blob URLs for preview while uploading
  const mainPreview = mainUrl || (mainPhoto instanceof Blob ? URL.createObjectURL(mainPhoto) : null)
  const pipPreview = pipUrl || (pipPhoto instanceof Blob ? URL.createObjectURL(pipPhoto) : null)

  const newConnections = party.filter(p => p.tier === 'fof' || p.tier === 'open')

  return (
    <div className="screen-enter min-h-screen bg-paper flex flex-col px-5 py-12 gap-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-rust italic text-4xl" style={{ fontFamily: "'Fraunces', serif" }}>Quest complete.</h1>
        <p className="text-gold text-xs mt-2 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          ★ +{quest?.xp || 100} XP EARNED
        </p>
      </div>

      {/* Memory card */}
      <div ref={cardRef} className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Photo area */}
        <div className="relative h-60 bg-dark/10">
          {uploading ? (
            <div className="absolute inset-0 bg-gradient-to-r from-paper/20 via-paper/40 to-paper/20 animate-pulse" />
          ) : mainPreview ? (
            <img src={mainPreview} alt="quest photo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-dark/20 text-5xl">◐</span>
            </div>
          )}
          {pipPreview && (
            <div className="absolute top-2 left-2 w-16 h-24 rounded-lg border-2 border-white overflow-hidden">
              <img src={pipPreview} alt="PiP photo" className="w-full h-full object-cover" />
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
              { label: 'TIME', value: formatElapsed(elapsedSec) },
              { label: 'PARTY', value: `${party.length + 1}` },
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

      {/* New connections */}
      {newConnections.map(p => (
        <div key={p.userId} className="bg-white rounded-xl p-4 border border-gold/20">
          <p className="text-gold text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>NEW CONNECTION</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark font-medium">{p.name}</p>
              {p.viaName && <p className="text-dark/40 text-xs">via {p.viaName}</p>}
            </div>
            <button onClick={() => addFriend(p.userId)} className="text-rust text-sm border border-rust/30 px-3 py-1 rounded-full hover:bg-rust hover:text-white transition-colors">
              + Add friend
            </button>
          </div>
        </div>
      ))}

      {/* Reactions */}
      <div className="flex gap-3 justify-center">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              myReactions.has(emoji)
                ? 'bg-rust/10 border border-rust/30 scale-110'
                : 'bg-dark/5 border border-dark/10'
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            {grouped[emoji] > 0 && (
              <span className="text-[10px] font-mono text-dark/50">{grouped[emoji]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={saveCard}
          disabled={generatingCard}
          className="flex-1 border border-dark/20 text-dark text-sm tracking-widest uppercase py-3 hover:bg-dark/5 transition-colors disabled:opacity-40"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {generatingCard ? 'Generating card…' : 'Save card'}
        </button>
        <button
          onClick={() => navigate('/home')}
          className="flex-1 bg-dark text-paper text-sm tracking-widest uppercase py-3"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
