import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppState } from '../context/AppState'
import { usePartySync } from '../hooks/usePartySync'
import { useToast } from '../context/ToastContext'

// Format milliseconds remaining as MM:SS
function formatTime(ms) {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Generate a consistent color for an avatar initial
function avatarColor(name = '') {
  const colors = [
    '#c44829', '#d4a02a', '#2a8c6e', '#5a4fcf', '#c4298a', '#2a7cc4'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function ActiveQuest() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { showTimeout } = useAppState()
  const { showToast } = useToast()

  // Pull state from router — support both named state keys
  const routeState = location.state ?? {}
  const activeQuest = routeState.activeQuest ?? null
  const party = routeState.party ?? []

  // Party sync state
  const [partyStatuses, setPartyStatuses] = useState({})
  const sessionId = localStorage.getItem('sq_session_id')
  const { markCompleted } = usePartySync(sessionId, user?.id, setPartyStatuses)

  // Timer state
  const [remaining, setRemaining] = useState(null)
  const intervalRef = useRef(null)
  const sessionCreatedRef = useRef(false)

  // Camera state
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [capturedPhoto, setCapturedPhoto] = useState(null) // object URL for preview
  const [flashVisible, setFlashVisible] = useState(false)
  const [shutterFired, setShutterFired] = useState(false)

  // Dual camera state
  const [dualMode, setDualMode] = useState(false)
  const [capturedPip, setCapturedPip] = useState(null)

  // Refs for camera elements
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Dual camera refs
  const pipStreamRef = useRef(null)
  const pipVideoRef = useRef(null)
  const pipCanvasRef = useRef(null)

  // Derive timer color class based on remaining time
  const timerColor = (() => {
    if (remaining === null) return '#c44829'
    if (remaining < 5 * 60 * 1000) return '#ef4444'
    if (remaining < 15 * 60 * 1000) return '#e8702a'
    return '#c44829'
  })()

  const isShaking = remaining !== null && remaining < 5 * 60 * 1000

  // ── Quest session creation ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeQuest || !user || sessionCreatedRef.current) return

    const existingSessionId = localStorage.getItem('sq_session_id')
    if (existingSessionId) {
      sessionCreatedRef.current = true
      return
    }

    sessionCreatedRef.current = true

    async function createSession() {
      const { data, error } = await supabase
        .from('quest_sessions')
        .insert({
          quest_id: activeQuest.quest_id,
          user_id: user.id,
          party_ids: party.map(p => p.userId ?? p.id),
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (!error && data?.id) {
        localStorage.setItem('sq_session_id', data.id)
      }
    }

    createSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Timer setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeQuest) return

    // Persist session start (refresh-safe)
    if (!localStorage.getItem('sq_session_started_at')) {
      localStorage.setItem('sq_session_started_at', new Date().toISOString())
    }

    const expiresAt = new Date(activeQuest.expires_at).getTime()

    function tick() {
      const now = Date.now()
      const diff = expiresAt - now
      setRemaining(diff)

      if (diff <= 0) {
        clearInterval(intervalRef.current)
        showTimeout('timeout')
      }
    }

    tick() // run immediately
    intervalRef.current = setInterval(tick, 1000)

    return () => clearInterval(intervalRef.current)
  }, [activeQuest, navigate])

  // ── Stream cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (pipStreamRef.current) {
        pipStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // ── Camera enable ─────────────────────────────────────────────────────────
  const enableCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraEnabled(true)
    } catch (err) {
      setCameraError('Camera unavailable — tap SKIP to continue without a photo')
      showToast('Camera unavailable', 'error')
    }
  }, [facingMode])

  // ── Flip camera ───────────────────────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setCameraError('Camera unavailable — tap SKIP to continue without a photo')
      showToast('Camera unavailable', 'error')
      setCameraEnabled(false)
    }
  }, [facingMode])

  // ── Toggle dual mode ──────────────────────────────────────────────────────
  const toggleDualMode = useCallback(async () => {
    if (dualMode) {
      // Turn OFF dual mode
      if (pipStreamRef.current) {
        pipStreamRef.current.getTracks().forEach(track => track.stop())
        pipStreamRef.current = null
      }
      setDualMode(false)
    } else {
      // iOS check — simultaneous dual streams not supported
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        showToast('Dual camera not supported on this device', 'warning')
        return
      }

      // Turn ON dual mode — request front camera as PiP
      try {
        const pipStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        pipStreamRef.current = pipStream
        if (pipVideoRef.current) {
          pipVideoRef.current.srcObject = pipStream
        }
        setDualMode(true)
      } catch (err) {
        showToast('Dual camera not supported on this device', 'warning')
        setDualMode(false)
      }
    }
  }, [dualMode])

  // ── Complete quest ────────────────────────────────────────────────────────
  const completeQuest = useCallback(async (mainPhoto, pipPhoto = null) => {
    const startedAtStr = localStorage.getItem('sq_session_started_at')
    const startedAt = startedAtStr ? new Date(startedAtStr) : new Date()
    const elapsedSec = Math.round((Date.now() - startedAt.getTime()) / 1000)
    const sessionId = localStorage.getItem('sq_session_id')

    // Mark current user as completed in party_status
    await markCompleted()

    // Stop camera streams before navigating
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (pipStreamRef.current) {
      pipStreamRef.current.getTracks().forEach(track => track.stop())
      pipStreamRef.current = null
    }

    // Clear session keys so the next quest gets a fresh session
    localStorage.removeItem('sq_session_id')
    localStorage.removeItem('sq_session_started_at')

    navigate('/memory', {
      state: {
        mainPhoto,
        pipPhoto,
        sessionId,
        quest: activeQuest?.quest,
        party,
        elapsedSec,
      },
    })
  }, [navigate, activeQuest, party, markCompleted])

  // ── Capture photo ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')

    if (facingMode === 'user') {
      // Mirror for selfie
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0) // restore
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    // Flash effect
    setFlashVisible(true)
    setTimeout(() => setFlashVisible(false), 80)

    // Shutter ring effect
    setShutterFired(true)
    setTimeout(() => setShutterFired(false), 400)

    if (dualMode && pipVideoRef.current && pipCanvasRef.current) {
      // Dual capture — grab both canvases as blobs
      const pipCanvas = pipCanvasRef.current
      pipCanvas.width = 300
      pipCanvas.height = 420
      const pipCtx = pipCanvas.getContext('2d')
      const pipVideo = pipVideoRef.current

      // Draw PiP mirrored (front camera)
      pipCtx.translate(300, 0)
      pipCtx.scale(-1, 1)
      pipCtx.drawImage(pipVideo, 0, 0, 300, 420)
      pipCtx.setTransform(1, 0, 0, 1, 0, 0)

      const mainBlobPromise = new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75)
      })
      const pipBlobPromise = new Promise((resolve) => {
        pipCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75)
      })

      Promise.all([mainBlobPromise, pipBlobPromise]).then(([mainBlob, pipBlob]) => {
        if (!mainBlob) return
        const objectUrl = URL.createObjectURL(mainBlob)
        setCapturedPhoto(objectUrl)
        if (pipBlob) {
          const pipUrl = URL.createObjectURL(pipBlob)
          setCapturedPip(pipUrl)
        }
        setTimeout(() => {
          completeQuest(mainBlob, pipBlob)
        }, 1200)
      })
    } else {
      // Single capture
      canvas.toBlob((blob) => {
        if (!blob) return
        const objectUrl = URL.createObjectURL(blob)
        setCapturedPhoto(objectUrl)

        // After 1200ms, complete the quest with the blob
        setTimeout(() => {
          completeQuest(blob, null)
        }, 1200)
      }, 'image/jpeg', 0.75)
    }
  }, [facingMode, dualMode, completeQuest])

  // ── Abandon handler ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    const confirmed = window.confirm('Abandon quest? Your streak resets.')
    if (confirmed) navigate('/home')
  }, [navigate])

  // ── Fallback if no activeQuest in state ───────────────────────────────────
  if (!activeQuest) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-4">
        <p className="font-mono text-paper/60 text-sm">No active quest found.</p>
        <button
          onClick={() => navigate('/home')}
          className="font-mono text-xs text-rust tracking-widest uppercase"
        >
          ← Back to Home
        </button>
      </div>
    )
  }

  const quest = activeQuest.quest ?? {}
  const title = quest.title ?? 'Quest'
  const description = quest.description ?? ''

  return (
    <div className="min-h-screen bg-dark flex flex-col" style={{ background: '#1a1612' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        {/* Back / abandon */}
        <button
          onClick={handleBack}
          className="text-paper/70 text-2xl leading-none hover:text-paper transition-colors"
          aria-label="Abandon quest"
        >
          ←
        </button>

        {/* Timer pill */}
        <TimerPill remaining={remaining} color={timerColor} shaking={isShaking} />
      </div>

      {/* ── Quest header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-2 pb-4 flex flex-col gap-2">
        {/* "▲ QUEST IN PROGRESS" label */}
        <p
          className="tracking-widest text-xs font-mono font-medium"
          style={{
            color: '#d4a02a',
            fontVariant: 'small-caps',
            letterSpacing: '0.22em',
          }}
        >
          ▲ QUEST IN PROGRESS
        </p>

        {/* Quest title */}
        <h1
          className="text-3xl leading-tight text-paper"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600 }}
        >
          {title}
        </h1>

        {/* Quest description */}
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'rgba(244,237,224,0.6)', fontFamily: "'Bricolage Grotesque', sans-serif" }}
        >
          {description}
        </p>

        {/* Party row */}
        <PartyRow party={party} partyStatuses={partyStatuses} />
      </div>

      {/* ── Camera frame ─────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pb-2 min-h-[280px]">
        <div
          className="w-full h-full rounded-2xl border border-paper/10 overflow-hidden relative flex flex-col items-center justify-center gap-4"
          style={{ background: '#0d0b09', minHeight: 280 }}
        >
          {/* Captured photo preview */}
          {capturedPhoto && (
            <img
              src={capturedPhoto}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
            />
          )}

          {/* Live video feed */}
          {cameraEnabled && !capturedPhoto && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
            />
          )}

          {/* PiP video (front camera) — visible when dualMode is ON */}
          {cameraEnabled && !capturedPhoto && dualMode && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 100,
                height: 140,
                border: '2px solid #ffffff',
                borderRadius: 8,
                overflow: 'hidden',
                zIndex: 20,
              }}
            >
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                }}
              />
            </div>
          )}

          {/* DUAL toggle button — visible when camera is enabled */}
          {cameraEnabled && (
            <button
              onClick={toggleDualMode}
              style={{
                position: 'absolute',
                top: 8,
                left: dualMode ? 116 : 8,
                zIndex: 30,
                background: dualMode ? '#c44829' : 'rgba(0,0,0,0.6)',
                border: 'none',
                borderRadius: 4,
                color: '#f4ede0',
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '3px 7px',
                cursor: 'pointer',
                transition: 'background 0.2s, left 0.2s',
              }}
              aria-label="Toggle dual camera"
            >
              DUAL
            </button>
          )}

          {/* Placeholder — shown when camera not yet enabled and no error */}
          {!cameraEnabled && !cameraError && (
            <>
              <div className="text-paper/30 text-5xl">📷</div>
              <p className="text-paper/40 text-sm font-mono">
                Tap to enable camera
              </p>
              <button
                onClick={enableCamera}
                className="px-5 py-2 rounded-full border border-paper/20 text-paper/60 text-xs font-mono tracking-wider hover:border-paper/40 hover:text-paper/80 transition-all"
              >
                Enable Camera
              </button>
            </>
          )}

          {/* Error state */}
          {cameraError && (
            <p className="text-paper/60 text-sm font-mono text-center px-6">
              {cameraError}
            </p>
          )}

          {/* Flash overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: '#ffffff',
              opacity: flashVisible ? 1 : 0,
              transition: flashVisible ? 'none' : 'opacity 120ms ease-out',
              zIndex: 50,
            }}
          />

          {/* Hidden canvas for main capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Hidden canvas for PiP capture */}
          <canvas ref={pipCanvasRef} style={{ display: 'none' }} />
        </div>
      </div>

      {/* ── Shutter row ──────────────────────────────────────────────────── */}
      <div className="px-6 pb-10 pt-3 flex items-center justify-between">
        {/* FLIP button */}
        <button
          onClick={cameraEnabled ? flipCamera : undefined}
          className={`font-mono text-xs tracking-widest transition-colors uppercase w-16 text-center ${
            cameraEnabled
              ? 'text-paper/50 hover:text-paper/80'
              : 'text-paper/20 cursor-default'
          }`}
        >
          Flip
        </button>

        {/* Shutter circle */}
        <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
          <button
            onClick={cameraEnabled && !capturedPhoto ? capturePhoto : undefined}
            className={`rounded-full flex items-center justify-center border-4 transition-all active:scale-95 ${
              cameraEnabled && !capturedPhoto
                ? 'border-paper/60 hover:border-paper active:scale-90'
                : 'border-paper/20 opacity-50 cursor-default'
            }`}
            style={{ width: 64, height: 64, background: '#fff' }}
            aria-label="Take photo"
          />
          {shutterFired && (
            <div className="absolute inset-0 rounded-full border-2 border-white animate-shutter-ring pointer-events-none" />
          )}
        </div>

        {/* SKIP button */}
        <button
          className="text-paper/50 font-mono text-xs tracking-widest hover:text-paper/80 transition-colors uppercase w-16 text-center"
          onClick={() => completeQuest(null)}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// ── Timer pill sub-component ─────────────────────────────────────────────────
function TimerPill({ remaining, color, shaking }) {
  const label = remaining === null ? '--:-- LEFT' : `${formatTime(remaining)} LEFT`

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full${shaking ? ' animate-shake' : ''}`}
      style={{ background: `${color}22`, border: `1px solid ${color}55` }}
    >
      {/* Pulsing dot */}
      <span
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ background: color }}
      />
      <span
        className="font-mono text-xs font-semibold tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Party status helper ──────────────────────────────────────────────────────
function getPartyStatus(memberId, partyStatuses) {
  const s = partyStatuses[memberId]
  if (!s) return 'unknown'
  if (s.status === 'completed') return 'completed'
  if (s.status === 'active' && (Date.now() - new Date(s.updatedAt).getTime()) < 30000) return 'active'
  return 'unknown'
}

// ── Party row sub-component ──────────────────────────────────────────────────
function PartyRow({ party, partyStatuses = {} }) {
  const isSolo = !party || party.length === 0

  return (
    <div className="flex items-center gap-3 mt-1">
      {/* Avatar stack */}
      {!isSolo && (
        <div className="flex items-center">
          {party.slice(0, 5).map((member, i) => {
            const name = member.name ?? member.username ?? '?'
            const initial = name[0]?.toUpperCase() ?? '?'
            const bg = avatarColor(name)
            const memberId = member.userId ?? member.id
            const status = getPartyStatus(memberId, partyStatuses)
            return (
              <div
                key={memberId ?? i}
                className="w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-mono font-bold text-dark"
                style={{
                  background: bg,
                  borderColor: '#1a1612',
                  marginLeft: i === 0 ? 0 : -8,
                  zIndex: party.length - i,
                  position: 'relative',
                }}
              >
                {initial}
                {/* Status indicator */}
                {status === 'active' && (
                  <span
                    className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400"
                    style={{ transform: 'translate(25%, 25%)' }}
                  />
                )}
                {status === 'completed' && (
                  <span
                    className="absolute bottom-0 right-0 text-gold text-xs leading-none"
                    style={{ transform: 'translate(25%, 25%)', fontSize: 9 }}
                  >
                    ✓
                  </span>
                )}
                {status === 'unknown' && (
                  <span
                    className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                    style={{ background: 'rgba(244,237,224,0.2)', transform: 'translate(25%, 25%)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Label */}
      <span
        className="font-mono text-xs tracking-widest"
        style={{ color: 'rgba(244,237,224,0.5)', fontVariant: 'small-caps' }}
      >
        {isSolo ? 'GOING SOLO' : `PARTY OF ${party.length}`}
      </span>
    </div>
  )
}
