import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'sidequest_install_banner_dismissed'

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return

    if (isIOS()) {
      // Only show on iOS if not already in standalone mode
      if (!window.navigator.standalone) {
        setShowIOS(true)
      }
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShowAndroid(false)
    setShowIOS(false)
    setDeferredPrompt(null)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      dismiss()
    }
  }

  if (!showAndroid && !showIOS) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '64px', // above tab bar
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#1a1612',
        borderTop: '1px solid #c44829',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1 }}>
        {showAndroid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#f4ede0', fontSize: '14px', fontWeight: 500 }}>
              Install Side/Quest
            </span>
            <button
              onClick={handleInstall}
              style={{
                background: '#c44829',
                color: '#f4ede0',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Install
            </button>
          </div>
        )}
        {showIOS && (
          <span style={{ color: '#f4ede0', fontSize: '14px' }}>
            Tap{' '}
            <span style={{ color: '#c44829', fontWeight: 600 }}>share</span>
            {' → '}
            <span style={{ color: '#c44829', fontWeight: 600 }}>Add to Home Screen</span>
          </span>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#f4ede0',
          fontSize: '20px',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px',
          opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  )
}
