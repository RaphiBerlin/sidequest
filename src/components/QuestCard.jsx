import { useState, useRef, useEffect } from 'react'
import { photoUrl } from '../lib/photoUrl'

const CARD_STYLES = `
  .sq-paper-grain::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.10  0 0 0 0 0.08  0 0 0 0 0.05  0 0 0 0.42 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    background-size: 220px 220px;
    mix-blend-mode: multiply;
    opacity: 0.32;
    border-radius: inherit;
  }
  .sq-paper-vignette::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 30% 18%, rgba(255,235,190,0.35), transparent 55%),
      radial-gradient(ellipse at 80% 100%, rgba(140,70,30,0.18), transparent 60%);
    mix-blend-mode: soft-light;
    border-radius: inherit;
  }
  .sq-hero-grain::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
    background-size: 180px 180px;
    mix-blend-mode: overlay;
    opacity: 0.22;
    pointer-events: none;
    border-radius: inherit;
  }
  .sq-shimmer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      linear-gradient(
        115deg,
        transparent 35%,
        rgba(255,245,210,0.00) 42%,
        rgba(255,245,210,0.55) 48%,
        rgba(255,220,160,0.30) 52%,
        rgba(255,245,210,0.00) 58%,
        transparent 65%
      );
    background-size: 250% 250%;
    background-position: var(--sq-sx, 50%) var(--sq-sy, 50%);
    mix-blend-mode: soft-light;
    opacity: 0;
    transition: opacity 220ms ease;
  }
  .sq-prism {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      conic-gradient(
        from 0deg at var(--sq-sx,50%) var(--sq-sy,50%),
        rgba(200,80,80,0.18),
        rgba(220,180,80,0.18),
        rgba(120,200,140,0.18),
        rgba(110,170,220,0.18),
        rgba(180,120,200,0.18),
        rgba(200,80,80,0.18)
      );
    mix-blend-mode: color-dodge;
    opacity: 0;
    transition: opacity 220ms ease;
  }
  .sq-card.sq-hover .sq-shimmer { opacity: 0.85; }
  .sq-card.sq-hover .sq-prism   { opacity: 0.35; }

  .sq-outlined-title {
    color: #1a1612;
    paint-order: stroke fill;
    text-shadow: 0 2px 0 rgba(0,0,0,0.22);
  }
  .sq-outlined-eyebrow {
    color: #c44829;
    paint-order: stroke fill;
  }
  .sq-outlined-body {
    color: #1a1612;
    paint-order: stroke fill;
  }
`

const pad2 = (n) => String(n).padStart(2, '0')

const fmtDate = (iso) => {
  const d = new Date(iso)
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const day = d.getDate()
  const ord = (n) => {
    const v = n % 100
    if (v >= 11 && v <= 13) return 'th'
    switch (n % 10) {
      case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'
    }
  }
  return `${months[d.getMonth()]} ${day}${ord(day)} ${d.getFullYear()}`
}

export default function QuestCard({ session: s, width = 320 }) {
  const sc = width / 320
  const ref = useRef(null)
  const [hover, setHover] = useState(false)
  const [press, setPress] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, sx: 50, sy: 50 })
  const [bandLineColor, setBandLineColor] = useState('rgba(212,160,42,0.7)')

  // Inject styles once
  useEffect(() => {
    if (document.getElementById('sq-card-styles')) return
    const el = document.createElement('style')
    el.id = 'sq-card-styles'
    el.textContent = CARD_STYLES
    document.head.appendChild(el)
  }, [])

  // Sample bottom of photo to get adaptive band separator color
  useEffect(() => {
    if (!s.photo_url) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const W = 80, H = 100
        const canvas = document.createElement('canvas')
        canvas.width = W; canvas.height = H
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, W, H)
        const data = ctx.getImageData(0, Math.round(H * 0.78), W, Math.round(H * 0.10)).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; n++ }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
        // Lighten toward white so the line reads on dark photos
        const mix = 0.45
        r = Math.round(r + (255 - r) * mix)
        g = Math.round(g + (255 - g) * mix)
        b = Math.round(b + (255 - b) * mix)
        setBandLineColor(`rgba(${r},${g},${b},0.85)`)
      } catch {
        // CORS failure — keep gold default
      }
    }
    img.src = photoUrl(s.photo_url, 80, 60)
  }, [s.photo_url])

  function onMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const r = ref.current.getBoundingClientRect()
    const px = (clientX - r.left) / r.width
    const py = (clientY - r.top) / r.height
    setTilt({ rx: (py - 0.5) * -9, ry: (px - 0.5) * 11, sx: px * 100, sy: py * 100 })
  }
  function onLeave() {
    setHover(false); setPress(false)
    setTilt({ rx: 0, ry: 0, sx: 50, sy: 50 })
  }

  const partySize = (s.party_ids?.length || 0) + 1
  const partyLabel = partySize === 1 ? 'Solo Quest' : 'Crew Quest'

  return (
    <div style={{ perspective: '1400px', display: 'inline-block' }}>
      <div
        ref={ref}
        className={`sq-card sq-paper-grain sq-paper-vignette${hover ? ' sq-hover' : ''}`}
        style={{
          position: 'relative',
          width,
          aspectRatio: '2.5 / 3.5',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #f6efe1 0%, #f1e8d4 55%, #e9dcc0 100%)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.04), 0 30px 60px -20px rgba(0,0,0,0.7), 0 12px 24px -12px rgba(0,0,0,0.55)',
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0) scale(${press ? 0.985 : hover ? 1.015 : 1})`,
          transition: press ? 'transform 80ms ease-out' : 'transform 220ms cubic-bezier(.2,.7,.2,1)',
          '--sq-sx': `${tilt.sx}%`,
          '--sq-sy': `${tilt.sy}%`,
          cursor: 'default',
          userSelect: 'none',
        }}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={onLeave}
        onMouseDown={() => setPress(true)}
        onMouseUp={() => setPress(false)}
        onTouchMove={onMove}
        onTouchStart={() => setHover(true)}
        onTouchEnd={onLeave}
      >
        {/* Cream paper border grain + warm vignette */}
        <div className="sq-paper-grain sq-paper-vignette" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1 }} />

        {/* Photo window — inset 10px so cream border shows around edges */}
        <div
          style={{
            position: 'absolute',
            inset: 10,
            borderRadius: 5,
            overflow: 'hidden',
            background: '#1a1612',
            boxShadow:
              'inset 0 0 0 1.5px rgba(26,22,18,0.95), inset 0 0 0 3px rgba(244,237,224,0.95), inset 0 0 0 4.5px rgba(212,160,42,0.95), inset 0 0 0 5.5px rgba(26,22,18,0.9)',
            zIndex: 2,
          }}
        >
          {s.photo_url ? (
            <img
              src={photoUrl(s.photo_url, width)}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.92) contrast(1.04)' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c8b387 0%, #d4a02a 50%, #c44829 100%)' }} />
          )}

          {/* Film grain */}
          <div className="sq-hero-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

          {/* Dark vignette top + bottom so outlined text reads over any photo */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(20,12,6,0.42) 0%, transparent 26%, transparent 52%, rgba(20,12,6,0.52) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
        </div>

        {/* Content overlay — sits above the photo window */}
        <div
          style={{
            position: 'absolute',
            inset: 10,
            borderRadius: 5,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 3,
            overflow: 'hidden',
          }}
        >
          {/* ── TOP: eyebrow + title ── */}
          <div style={{ paddingTop: Math.round(14 * sc), paddingLeft: '5%', paddingRight: Math.round(12 * sc) }}>
            <div
              className="sq-outlined-eyebrow"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: Math.round(11 * sc),
                fontWeight: 800,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                marginBottom: Math.round(5 * sc),
                lineHeight: 1,
                WebkitTextStroke: `${(2.4 * sc).toFixed(1)}px #ffffff`,
              }}
            >
              {partyLabel}
            </div>
            <h2
              className="sq-outlined-title"
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: Math.round(30 * sc),
                lineHeight: 1.04,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                WebkitTextStroke: `${(5 * sc).toFixed(1)}px #ffffff`,
              }}
            >
              {s.quest?.title || 'Quest'}
            </h2>
          </div>

          {/* Photo shows through the flex spacer */}
          <div style={{ flex: 1 }} />

          {/* ── DESCRIPTION ── */}
          <div style={{ padding: `0 ${Math.round(14 * sc)}px ${Math.round(6 * sc)}px` }}>
            <p
              className="sq-outlined-body"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: Math.round(13 * sc),
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                WebkitTextStroke: `${(2.8 * sc).toFixed(1)}px #ffffff`,
              }}
            >
              {s.quest?.description || ''}
            </p>
          </div>

          {/* ── BOTTOM BAND: date · name ── */}
          <div
            style={{
              background: 'rgba(20,14,8,0.22)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              borderTop: `1px solid ${bandLineColor}`,
              padding: `${Math.round(5 * sc)}px ${Math.round(10 * sc)}px`,
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(8 * sc),
            }}
          >
            <span
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: Math.round(10 * sc),
                color: 'rgba(244,237,224,0.9)',
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              {fmtDate(s.completed_at)}
            </span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: Math.round(11 * sc),
                color: 'rgba(244,237,224,0.9)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: Math.round(140 * sc),
              }}
            >
              {s.user?.name || ''}
            </span>
          </div>
        </div>

        {/* Foil effects */}
        <div className="sq-prism" style={{ zIndex: 4 }} />
        <div className="sq-shimmer" style={{ zIndex: 4 }} />
      </div>
    </div>
  )
}
