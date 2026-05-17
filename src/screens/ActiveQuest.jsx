import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppState } from '../context/AppState'
import { usePartySync } from '../hooks/usePartySync'
import { useToast } from '../context/ToastContext'

// HUD bar heights and PiP dimensions derived from viewport at load time
const HUD_HEIGHT = Math.max(80, Math.round(window.innerHeight * 0.13))
const CAMERA_BOX_H = Math.max(140, Math.round(window.innerHeight * 0.19))
const PIP_W = Math.round(window.innerWidth * 0.23)
const PIP_H = Math.round(PIP_W * (3.5 / 2.5))
const PIP_TOP = Math.round(window.innerHeight * 0.10)
const SHUTTER_PAD = Math.round(window.innerWidth * 0.10)

// Darkened crop-guide bars that show the exact 2.5:3.5 capture boundary
function CropGuide() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const CARD_RATIO = 2.5 / 3.5
  let cardW, cardH
  if (vw / vh > CARD_RATIO) {
    cardH = vh; cardW = cardH * CARD_RATIO
  } else {
    cardW = vw; cardH = cardW / CARD_RATIO
  }
  const barsX = Math.max(0, (vw - cardW) / 2)
  const barsY = Math.max(0, (vh - cardH) / 2)
  const SHADE = 'rgba(0,0,0,0.55)'
  const BRACKET = 24
  const THICK = 2
  const corners = [
    { top: barsY, left: barsX },
    { top: barsY, right: barsX },
    { bottom: barsY, left: barsX },
    { bottom: barsY, right: barsX },
  ]
  return (
    <>
      {barsY > 0 && <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barsY, background: SHADE, zIndex: 10, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barsY, background: SHADE, zIndex: 10, pointerEvents: 'none' }} />
      </>}
      {barsX > 0 && <>
        <div style={{ position: 'absolute', top: barsY, bottom: barsY, left: 0, width: barsX, background: SHADE, zIndex: 10, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: barsY, bottom: barsY, right: 0, width: barsX, background: SHADE, zIndex: 10, pointerEvents: 'none' }} />
      </>}
      {/* Corner brackets */}
      {corners.map((pos, i) => {
        const isRight = pos.right !== undefined
        const isBottom = pos.bottom !== undefined
        return (
          <div key={i} style={{ position: 'absolute', zIndex: 11, pointerEvents: 'none', ...pos }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: BRACKET, height: THICK, background: '#f4ede0', ...(isRight ? { left: 'auto', right: 0 } : {}) }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: THICK, height: BRACKET, background: '#f4ede0', ...(isRight ? { left: 'auto', right: 0 } : {}), ...(isBottom ? { top: 'auto', bottom: 0 } : {}) }} />
          </div>
        )
      })}
    </>
  )
}

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
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('sq_session_id'))
  const { markCompleted } = usePartySync(sessionId, user?.id, setPartyStatuses)

  // Live crew invites (for sessions started via the brief sheet invite flow)
  const [crewInvites, setCrewInvites] = useState([])
  const crewChannelRef = useRef(null)

  useEffect(() => {
    if (!sessionId) return
    async function fetchCrew() {
      const { data } = await supabase
        .from('crew_invites')
        .select('id, to_user_id, status, to_user:users!crew_invites_to_user_id_fkey(id, name, avatar_url, avatar_color)')
        .eq('session_id', sessionId)
      setCrewInvites(data || [])
    }
    fetchCrew()
    crewChannelRef.current = supabase
      .channel(`aq-crew-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crew_invites', filter: `session_id=eq.${sessionId}` }, () => fetchCrew())
      .subscribe()
    return () => { if (crewChannelRef.current) supabase.removeChannel(crewChannelRef.current) }
  }, [sessionId])

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
  const [streamReady, setStreamReady] = useState(false)

  // Dual camera state
  const [dualMode, setDualMode] = useState(false)
  const [capturedPip, setCapturedPip] = useState(null)

  // Expand-in-place camera overlay state
  const [cameraExpanded, setCameraExpanded] = useState(false)
  const [overlayStyle, setOverlayStyle] = useState(null)
  const cameraFrameRef = useRef(null)

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
        setSessionId(data.id)
      } else if (error) {
        console.error('Session creation failed:', error)
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

  // ── Expand / collapse camera overlay ─────────────────────────────────────
  const expandCamera = useCallback(() => {
    const rect = cameraFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    // Phase 1: place overlay exactly on top of the in-layout card (no transition)
    setOverlayStyle({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 16,
      transition: 'none',
    })
    setCameraExpanded(true)
    if (!cameraEnabled) enableCamera()
    // Phase 2: next paint — animate to full screen
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlayStyle({
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: 0,
          transition: 'top 0.45s cubic-bezier(0.32,0.72,0,1), left 0.45s cubic-bezier(0.32,0.72,0,1), width 0.45s cubic-bezier(0.32,0.72,0,1), height 0.45s cubic-bezier(0.32,0.72,0,1), border-radius 0.45s cubic-bezier(0.32,0.72,0,1)',
        })
      })
    })
  }, [])

  const collapseCamera = useCallback(() => {
    const rect = cameraFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    // Animate back to card position
    setOverlayStyle(prev => ({
      ...prev,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 16,
      transition: 'top 0.4s cubic-bezier(0.32,0.72,0,1), left 0.4s cubic-bezier(0.32,0.72,0,1), width 0.4s cubic-bezier(0.32,0.72,0,1), height 0.4s cubic-bezier(0.32,0.72,0,1), border-radius 0.4s cubic-bezier(0.32,0.72,0,1)',
    }))
    setTimeout(() => {
      setCameraExpanded(false)
      setOverlayStyle(null)
      setCameraEnabled(false)
      setCapturedPhoto(null)
      setCapturedPip(null)
      setDualMode(false)
      setStreamReady(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (pipStreamRef.current) {
        pipStreamRef.current.getTracks().forEach(t => t.stop())
        pipStreamRef.current = null
      }
    }, 420)
  }, [])

  // ── Camera enable ─────────────────────────────────────────────────────────
  const enableCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 3840 }, height: { ideal: 2160 } },
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
    // sessionId comes from state (set when session was created), not re-read from localStorage

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
  }, [navigate, activeQuest, party, markCompleted, sessionId])

  // ── Capture photo ─────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (!video.videoWidth || !video.videoHeight) return  // stream not ready yet

    // Crop video to card aspect ratio (2.5 / 3.5)
    const CARD_W = 1440, CARD_H = 2016
    const cardAspect = CARD_W / CARD_H
    const videoW = video.videoWidth
    const videoH = video.videoHeight
    const videoAspect = videoW / videoH
    let sx, sy, sw, sh
    if (videoAspect > cardAspect) {
      sh = videoH; sw = videoH * cardAspect; sx = (videoW - sw) / 2; sy = 0
    } else {
      sw = videoW; sh = videoW / cardAspect; sx = 0; sy = (videoH - sh) / 2
    }
    canvas.width = CARD_W
    canvas.height = CARD_H

    const ctx = canvas.getContext('2d')

    if (facingMode === 'user') {
      // Mirror for selfie
      ctx.translate(CARD_W, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CARD_W, CARD_H)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CARD_W, CARD_H)
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
      pipCanvas.width = 600
      pipCanvas.height = 840
      const pipCtx = pipCanvas.getContext('2d')
      const pipVideo = pipVideoRef.current

      // Draw PiP mirrored (front camera)
      pipCtx.translate(600, 0)
      pipCtx.scale(-1, 1)
      pipCtx.drawImage(pipVideo, 0, 0, 600, 840)
      pipCtx.setTransform(1, 0, 0, 1, 0, 0)

      const mainBlobPromise = new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
      })
      const pipBlobPromise = new Promise((resolve) => {
        pipCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
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
      }, 'image/jpeg', 0.92)
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
          className="leading-tight text-paper"
          style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 'clamp(22px, 7vw, 30px)' }}
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
        <PartyRow party={party} partyStatuses={partyStatuses} crewInvites={crewInvites} />
      </div>

      {/* ── Camera card — tap to open full-screen capture ───────────────── */}
      <div className="px-4 pb-4">
        <button
          ref={cameraFrameRef}
          onClick={expandCamera}
          className="w-full rounded-2xl border border-paper/10 overflow-hidden relative flex flex-col items-center justify-center gap-3 focus:outline-none"
          style={{ background: '#0d0b09', height: CAMERA_BOX_H, visibility: cameraExpanded ? 'hidden' : 'visible' }}
          aria-label="Open camera"
        >
          {capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(244,237,224,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <p className="text-paper/30 text-xs tracking-widest font-mono uppercase">Tap to capture</p>
            </>
          )}
        </button>
      </div>

      {/* ── Skip row (no shutter — controls are in the overlay) ──────────── */}
      <div className="px-6 pb-10 flex justify-end">
        <button
          className="text-paper/30 font-mono text-xs tracking-widest hover:text-paper/50 transition-colors uppercase"
          onClick={() => {
            if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
            if (pipStreamRef.current) { pipStreamRef.current.getTracks().forEach(t => t.stop()); pipStreamRef.current = null }
            navigate('/home')
          }}
        >
          Skip →
        </button>
      </div>

      {/* Hidden canvases for capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={pipCanvasRef} style={{ display: 'none' }} />

      {/* ── Expanded camera overlay ───────────────────────────────────────── */}
      {cameraExpanded && overlayStyle && (
        <div
          style={{
            position: 'fixed',
            top: overlayStyle.top,
            left: overlayStyle.left,
            width: overlayStyle.width,
            height: overlayStyle.height,
            borderRadius: overlayStyle.borderRadius,
            transition: overlayStyle.transition,
            background: '#000',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Live video — fills entire overlay */}
          {!capturedPhoto && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setStreamReady(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}

          {/* Captured photo preview */}
          {capturedPhoto && (
            <img src={capturedPhoto} alt="Captured" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}

          {/* PiP video */}
          {!capturedPhoto && dualMode && (
            <div style={{ position: 'absolute', top: PIP_TOP, left: 12, width: PIP_W, height: PIP_H, border: '2px solid #fff', borderRadius: 8, overflow: 'hidden', zIndex: 20 }}>
              <video ref={pipVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            </div>
          )}

          {/* Crop guide — darkened bars outside the 2.5:3.5 card zone */}
          <CropGuide />

          {/* Flash overlay */}
          <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flashVisible ? 1 : 0, transition: flashVisible ? 'none' : 'opacity 120ms ease-out', zIndex: 60, pointerEvents: 'none' }} />

          {/* HUD — top bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HUD_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, paddingTop: 'env(safe-area-inset-top, 0px)', zIndex: 40 }}>
            <button
              onClick={collapseCamera}
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: '50%', border: 'none', color: '#f4ede0', fontSize: 18, cursor: 'pointer' }}
              aria-label="Close camera"
            >
              ←
            </button>
            <TimerPill remaining={remaining} color={timerColor} shaking={isShaking} />
            {/* DUAL toggle */}
            <button
              onClick={toggleDualMode}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: dualMode ? '#c44829' : 'rgba(0,0,0,0.45)', color: '#f4ede0', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}
            >
              DUAL
            </button>
          </div>

          {/* Shutter controls — bottom bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HUD_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: SHUTTER_PAD, paddingRight: SHUTTER_PAD, paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 40 }}>
            {/* Flip */}
            <button
              onClick={flipCamera}
              style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', borderRadius: '50%', border: 'none', color: '#f4ede0', cursor: 'pointer' }}
              aria-label="Flip camera"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>

            {/* Shutter */}
            <div className="relative flex flex-col items-center" style={{ width: 72 }}>
              {!streamReady && !capturedPhoto && cameraEnabled && (
                <p style={{ position: 'absolute', top: -22, fontFamily: 'monospace', fontSize: 10, color: 'rgba(244,237,224,0.5)', whiteSpace: 'nowrap', letterSpacing: '0.08em' }}>
                  starting camera…
                </p>
              )}
              <div className="relative" style={{ width: 72, height: 72 }}>
                <button
                  onClick={!capturedPhoto && streamReady ? capturePhoto : undefined}
                  disabled={!!capturedPhoto || !streamReady}
                  style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff', border: '4px solid rgba(255,255,255,0.6)', cursor: (capturedPhoto || !streamReady) ? 'default' : 'pointer', transition: 'transform 0.1s, opacity 0.2s', boxShadow: '0 0 0 3px rgba(255,255,255,0.25)', opacity: (!capturedPhoto && !streamReady) ? 0.45 : 1 }}
                  className="active:scale-90"
                  aria-label="Take photo"
                />
                {shutterFired && (
                  <div className="absolute inset-0 rounded-full border-2 border-white animate-shutter-ring pointer-events-none" />
                )}
              </div>
            </div>

            {/* Spacer to balance flip button */}
            <div style={{ width: 44 }} />
          </div>

          {/* Error */}
          {cameraError && (
            <div style={{ position: 'absolute', bottom: HUD_HEIGHT + 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 40 }}>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(244,237,224,0.6)', background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 12px', textAlign: 'center', maxWidth: 260 }}>
                {cameraError}
              </p>
            </div>
          )}
        </div>
      )}
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
const INVITE_DOT = {
  pending:  { bg: 'rgba(212,160,42,0.9)',  title: 'Pending' },
  accepted: { bg: 'rgba(42,140,110,0.9)',  title: 'Joined'  },
  declined: { bg: 'rgba(196,72,41,0.9)',   title: 'Declined' },
}

function PartyRow({ party, partyStatuses = {}, crewInvites = [] }) {
  // Prefer crew invites (new flow) over nearby party (old flow)
  const hasCrewInvites = crewInvites.length > 0
  const isSolo = !hasCrewInvites && (!party || party.length === 0)

  if (hasCrewInvites) {
    return (
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        <div className="flex items-center">
          {crewInvites.slice(0, 5).map((inv, i) => {
            const name = inv.to_user?.name ?? '?'
            const initial = name[0]?.toUpperCase() ?? '?'
            const bg = avatarColor(name)
            const dot = INVITE_DOT[inv.status] ?? INVITE_DOT.pending
            return (
              <div
                key={inv.id}
                className="w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-mono font-bold text-dark"
                style={{ background: bg, borderColor: '#1a1612', marginLeft: i === 0 ? 0 : -8, zIndex: crewInvites.length - i, position: 'relative' }}
                title={`${name} — ${dot.title}`}
              >
                {initial}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ background: dot.bg, transform: 'translate(25%, 25%)' }} />
              </div>
            )
          })}
        </div>
        <span className="font-mono text-xs tracking-widest" style={{ color: 'rgba(244,237,224,0.5)', fontVariant: 'small-caps' }}>
          CREW OF {crewInvites.length}
        </span>
        {crewInvites.some(i => i.status === 'pending') && (
          <span className="font-mono text-[10px] tracking-widest" style={{ color: 'rgba(212,160,42,0.7)' }}>
            · waiting for {crewInvites.filter(i => i.status === 'pending').length}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 mt-1">
      {/* Avatar stack — nearby party flow */}
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
                style={{ background: bg, borderColor: '#1a1612', marginLeft: i === 0 ? 0 : -8, zIndex: party.length - i, position: 'relative' }}
              >
                {initial}
                {status === 'active' && (
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400" style={{ transform: 'translate(25%, 25%)' }} />
                )}
                {status === 'completed' && (
                  <span className="absolute bottom-0 right-0 text-gold text-xs leading-none" style={{ transform: 'translate(25%, 25%)', fontSize: 9 }}>✓</span>
                )}
                {status === 'unknown' && (
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ background: 'rgba(244,237,224,0.2)', transform: 'translate(25%, 25%)' }} />
                )}
              </div>
            )
          })}
        </div>
      )}
      <span className="font-mono text-xs tracking-widest" style={{ color: 'rgba(244,237,224,0.5)', fontVariant: 'small-caps' }}>
        {isSolo ? 'GOING SOLO' : `PARTY OF ${party.length}`}
      </span>
    </div>
  )
}
