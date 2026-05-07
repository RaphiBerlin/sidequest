import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuestDrop } from '../hooks/useQuestDrop'
import { getLocationContext } from '../lib/locationContext'
import { useLocation as useUserLocation } from '../hooks/useLocation'

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

export default function QuestDrop() {
  const navigate = useNavigate()
  const routerState = useLocation().state
  const { activeQuest: liveQuest } = useQuestDrop()
  const { location } = useUserLocation()
  const [now, setNow] = useState(new Date())
  const [contextLabel, setContextLabel] = useState(null)

  // Use router state quest or live quest
  const aq = routerState?.activeQuest ?? liveQuest
  const quest = aq?.quest

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!location) return
    getLocationContext(location.lat, location.lng).then((result) => {
      setContextLabel(result.label)
    })
  }, [location])

  function skip() {
    localStorage.setItem('sidequest_skipped_date', new Date().toDateString())
    navigate('/home')
  }

  return (
    <div className="screen-enter min-h-screen bg-dark flex flex-col items-center justify-center px-5 py-12 gap-6">
      {/* Incoming label */}
      <p
        className="text-gold text-xs tracking-[0.3em] uppercase animate-pulse"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        ▲ QUEST INCOMING ▲
      </p>

      {/* Time */}
      <div className="text-center">
        <p className="text-paper text-6xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>
          {formatTime(now)}
        </p>
        <p className="text-paper/40 text-xs tracking-widest mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {formatDate(now)}
        </p>
      </div>

      {/* Quest card */}
      <div
        className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl p-5 relative"
        style={{ transform: 'rotate(-1.5deg)' }}
      >
        {/* TODAY'S QUEST tag */}
        <div className="absolute -top-3 left-4 bg-rust text-dark text-xs font-bold px-3 py-1 tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          TODAY'S QUEST
        </div>
        {/* VERIFY stamp */}
        <div className="absolute -top-3 right-4 border-2 border-rust text-rust text-[9px] font-bold px-2 py-1 rounded-full tracking-wider uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          45 MIN
        </div>

        {/* Context tag */}
        {contextLabel && (
          <p className="text-rust text-xs font-mono tracking-widest mb-2">▾ TAILORED FOR {contextLabel.toUpperCase()}</p>
        )}

        {/* Quest title */}
        <h2
          className="text-dark italic text-3xl leading-tight my-4"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {quest?.title ?? 'Loading quest…'}
        </h2>

        {/* Meta pills */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {[
            { label: 'DURATION', value: `${quest?.duration_min ?? 25} MIN` },
            { label: 'PARTY', value: '2–4 PPL' },
            { label: 'RADIUS', value: '0.3 MI' },
          ].map(({ label, value }) => (
            <div key={label} className="border border-dark/20 rounded-full px-3 py-1 text-[10px] tracking-widest text-dark/60 uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {label}: {value}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/nearby', { state: { activeQuest: aq } })}
        className="w-full max-w-sm bg-rust text-dark text-sm tracking-widest uppercase py-4 font-bold hover:opacity-90 transition-opacity"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        SEE WHO'S NEARBY →
      </button>

      {/* Skip */}
      <button
        onClick={skip}
        className="text-paper/30 text-xs tracking-widest hover:text-paper/60 transition-colors"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Skip today's quest
      </button>
    </div>
  )
}
