import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [bouncing, setBouncing] = useState(null)

  const tabs = [
    {
      label: 'HOME',
      icon: (active) => (
        <img
          src="/icons/icon-1024.png"
          alt="Home"
          style={{ width: 44, height: 44, objectFit: 'contain', opacity: active ? 1 : 0.45, marginTop: -8, marginBottom: -8 }}
          draggable={false}
        />
      ),
      path: '/home',
    },
    { label: 'FEED', icon: () => '◎', path: '/feed' },
    { label: 'BINDER', icon: () => '▤', path: '/journal' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-sm border-t border-paper/10"
      style={{
        backgroundColor: 'rgba(26, 22, 18, 0.97)',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => {
                setBouncing(tab.path)
                setTimeout(() => setBouncing(null), 250)
                navigate(tab.path)
              }}
              className="flex flex-col items-center py-3 px-4 cursor-pointer"
              style={{ color: isActive ? '#d4a02a' : 'rgba(244, 237, 224, 0.4)' }}
            >
              <span
                className={`flex items-center justify-center${bouncing === tab.path ? ' animate-tab-bounce' : ''}`}
                style={{ height: 28, fontSize: '1.25rem' }}
              >
                {tab.icon(isActive)}
              </span>
              <span
                className="text-[10px] tracking-widest uppercase mt-0.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
