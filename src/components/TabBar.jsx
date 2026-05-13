import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotifications } from '../context/NotificationsContext'

function BellIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.45 }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [bouncing, setBouncing] = useState(null)
  const { unreadCount } = useNotifications()

  const tabs = [
    {
      label: 'HOME',
      icon: (active) => (
        <img
          src="/icons/icon-1024.png"
          alt="Home"
          style={{ width: 60, height: 60, objectFit: 'contain', opacity: active ? 1 : 0.45, marginTop: -16, marginBottom: -16 }}
          draggable={false}
        />
      ),
      path: '/home',
    },
    { label: 'FEED', icon: () => '◎', path: '/feed' },
    { label: 'JOURNAL', icon: () => '▤', path: '/journal' },
    {
      label: 'ALERTS',
      icon: (active) => (
        <div className="relative" style={{ height: 28, display: 'flex', alignItems: 'center' }}>
          <BellIcon active={active} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-paper"
              style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace", padding: '0 3px' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      ),
      path: '/notifications',
    },
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
