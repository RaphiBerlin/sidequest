import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocation } from '../hooks/useLocation'
import { getNearbyUsers } from '../lib/proximity'
import { writePresence, deletePresence } from '../lib/location'
import { supabase } from '../lib/supabase'
import Skeleton from '../components/Skeleton'
import ErrorCard from '../components/ErrorCard'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const TIER_COLORS = { friend: '#c44829', fof: '#d4a02a', open: '#6b8aa8' }

function AvatarCircle({ name, color, size = 40 }) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: `#${color}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: '#f4ede0', fontFamily: "'Fraunces', serif", fontStyle: 'italic', flexShrink: 0 }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function Nearby() {
  const navigate = useNavigate()
  const routerState = useRouterLocation().state
  const { user } = useAuth()
  const { location, locationError, requestLocation } = useLocation()
  const [nearby, setNearby] = useState([])
  const [loading, setLoading] = useState(true)
  const [nearbyError, setNearbyError] = useState(null)
  const [selected, setSelected] = useState([]) // array of userId strings
  const [invited, setInvited] = useState(new Set())
  const [lastUpdated, setLastUpdated] = useState(null)
  const [secsAgo, setSecsAgo] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const presenceChannelRef = useRef(null)
  const timerRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  async function fetchNearby() {
    if (!user || !location) return
    setNearbyError(null)
    try {
      const users = await getNearbyUsers(user.id, location.lat, location.lng)
      setNearby(users)
      setLastUpdated(new Date())
      setSecsAgo(0)
    } catch (e) {
      console.error(e)
      setNearbyError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !location) {
      if (!location) setLoading(false)
      return
    }

    // Write presence on mount
    writePresence(user.id).catch(e => console.error('writePresence error', e))

    // Initial fetch
    fetchNearby()

    // Subscribe to presence changes — refetch whenever anyone's location updates
    presenceChannelRef.current = supabase
      .channel('nearby-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, () => {
        fetchNearby()
      })
      .subscribe()

    // Live "X seconds ago" ticker
    timerRef.current = setInterval(() => {
      setSecsAgo(prev => (prev === null ? null : prev + 1))
    }, 1000)

    return () => {
      deletePresence(user.id).catch(e => console.error('deletePresence error', e))
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current)
      clearInterval(timerRef.current)
    }
  }, [location, user])

  // Init map once location is known
  useEffect(() => {
    if (!location || mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [location.lng, location.lat],
      zoom: 15.5,
      interactive: true,
      attributionControl: false,
    })
    mapRef.current = map
    // You are here marker
    const el = document.createElement('div')
    el.style.cssText = 'width:14px;height:14px;background:#c44829;border-radius:50%;border:2px solid #1a1612;box-shadow:0 0 0 4px rgba(196,72,41,0.3)'
    new mapboxgl.Marker({ element: el }).setLngLat([location.lng, location.lat]).addTo(map)
    map.on('load', () => setMapReady(true))
    return () => { map.remove(); mapRef.current = null; setMapReady(false) }
  }, [location])

  // Update nearby user markers whenever data or map readiness changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const withCoords = nearby.filter(u => u.lat != null && u.lng != null)
    if (!withCoords.length) return

    markersRef.current = withCoords.map(u => {
      const color = TIER_COLORS[u.tier] || '#888'
      const el = document.createElement('div')
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${color}; border: 2px solid #1a1612;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Fraunces', serif; font-style: italic;
        font-size: 13px; color: #f4ede0; cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      `
      el.textContent = u.name?.[0]?.toUpperCase() ?? '?'
      el.title = u.name
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([u.lng, u.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false })
          .setHTML(`<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:13px;color:#1a1612;font-weight:500">${u.name}</span>`))
        .addTo(mapRef.current)
      el.addEventListener('click', () => toggleSelect(u.userId))
      return marker
    })

    // Fit map to show user + all friends
    if (location) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([location.lng, location.lat])
      withCoords.forEach(u => bounds.extend([u.lng, u.lat]))
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 })
    }
  }, [nearby, mapReady])

  async function sendInvite(toUserId) {
    const sessionId = localStorage.getItem('sq_session_id')
    if (!sessionId) return
    await supabase.from('party_invites').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      session_id: sessionId
    })
    setInvited(prev => new Set([...prev, toUserId]))
  }

  function toggleSelect(userId) {
    setSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function startQuest() {
    const party = nearby.filter(u => selected.includes(u.userId))
    navigate('/active-quest', { state: { activeQuest: routerState?.activeQuest, party } })
  }


  if (locationError) {
    return (
      <div className="screen-enter min-h-screen bg-dark flex flex-col items-center justify-center px-5 text-center gap-6">
        <p className="text-paper/60 italic text-xl" style={{ fontFamily: "'Fraunces', serif" }}>Location needed to find nearby friends.</p>
        <button onClick={requestLocation} className="border border-rust text-rust text-sm tracking-widest uppercase px-6 py-3 hover:bg-rust hover:text-dark transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Enable location
        </button>
        {nearby.length > 0 && (
          <p className="text-paper/30 text-xs tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            DEMO MODE
          </p>
        )}
        <button onClick={startQuest} className="text-paper/30 text-xs tracking-widest hover:text-paper/50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Or go solo →
        </button>
      </div>
    )
  }

  if (!location) {
    return (
      <div className="screen-enter min-h-screen bg-dark flex flex-col items-center justify-center px-5 text-center gap-6">
        <p className="text-paper/60 italic text-xl" style={{ fontFamily: "'Fraunces', serif" }}>Location needed to find nearby friends.</p>
        <button onClick={requestLocation} className="border border-rust text-rust text-sm tracking-widest uppercase px-6 py-3 hover:bg-rust hover:text-dark transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Enable location
        </button>
        <button onClick={startQuest} className="text-paper/30 text-xs tracking-widest hover:text-paper/50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Or go solo →
        </button>
      </div>
    )
  }

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="text-paper/60 text-xl">←</button>
        <p className="text-paper/40 text-xs tracking-widest italic" style={{ fontFamily: "'Fraunces', serif" }}>
          {loading ? 'Locating…' : `${nearby.length} within 0.3 mi`}
        </p>
      </div>

      {/* Mapbox map */}
      <div className="mx-5 mb-4 rounded-xl overflow-hidden border border-paper/10" style={{ height: 280 }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-5 mb-4">
        {[['friend', 'Friends'], ['fof', 'Friends of'], ['open', 'Open']].map(([tier, label]) => (
          <div key={tier} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
            <span className="text-paper/40 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
          </div>
        ))}
        {secsAgo !== null && (
          <span className="ml-auto text-paper/20 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {secsAgo}s ago
          </span>
        )}
      </div>

      {/* TAP label */}
      <p className="px-5 text-paper/40 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        ▾ TAP TO BUILD YOUR PARTY
      </p>

      {/* Nearby list */}
      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-2">
        {loading ? (
          <>
            <Skeleton height="64px" borderRadius="8px" />
            <Skeleton height="64px" borderRadius="8px" />
            <Skeleton height="64px" borderRadius="8px" />
          </>
        ) : nearbyError ? (
          <ErrorCard message="Couldn't load nearby friends" onRetry={fetchNearby} />
        ) : nearby.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-paper/40 italic text-lg mb-4" style={{ fontFamily: "'Fraunces', serif" }}>No friends nearby right now.</p>
            <button onClick={startQuest} className="text-rust text-sm tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Go solo →</button>
          </div>
        ) : (
          nearby.map(u => {
            const isSelected = selected.includes(u.userId)
            return (
              <button
                key={u.userId}
                onClick={() => toggleSelect(u.userId)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isSelected ? 'border-rust bg-rust/5' : 'border-paper/10 bg-paper/5'}`}
              >
                <AvatarCircle name={u.name} color={u.avatarColor} />
                <div className="flex-1">
                  <p className="text-paper text-sm font-medium">{u.name}</p>
                  {u.tier === 'friend' && (
                    <p className="text-paper/40 text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      FRIEND · {u.distanceFt}ft
                    </p>
                  )}
                  {u.tier === 'fof' && (
                    <p className="text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#d4a02a' }}>
                      VIA {u.viaName ?? '?'} · mutual: {u.mutualCount ?? 0} · {u.distanceFt}ft
                    </p>
                  )}
                  {u.tier === 'open' && (
                    <p className="text-slate-400 text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      OPEN · open to questing · {u.distanceFt}ft
                    </p>
                  )}
                </div>
                {isSelected && <span className="text-rust text-sm">✓</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); sendInvite(u.userId) }}
                  disabled={invited.has(u.userId)}
                  className={`text-xs px-2 py-1 border rounded transition-colors ${
                    invited.has(u.userId)
                      ? 'border-paper/20 text-paper/30 cursor-default'
                      : 'border-rust/40 text-rust hover:bg-rust hover:text-dark'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {invited.has(u.userId) ? 'Invited ✓' : 'Invite'}
                </button>
              </button>
            )
          })
        )}
        <button onClick={startQuest} className="text-paper/30 text-xs tracking-widest text-center py-3 hover:text-paper/60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Or go solo →
        </button>
      </div>

      {/* Floating start bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-rust p-4 safe-area-pb">
          <button
            onClick={startQuest}
            className="w-full text-dark text-sm tracking-widest uppercase font-bold"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {selected.length} SELECTED — START QUEST →
          </button>
        </div>
      )}
    </div>
  )
}
