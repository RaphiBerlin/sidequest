import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'default', duration = 2500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-2), { id, message, type }]) // max 3 visible
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  )
}

const TYPE_STYLES = {
  default: 'bg-dark border-paper/20 text-paper',
  success: 'bg-dark border-green-600/40 text-green-400',
  error: 'bg-dark border-rust/40 text-rust',
  warning: 'bg-dark border-gold/40 text-gold',
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-14 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-3 rounded-xl border backdrop-blur-sm text-sm font-mono tracking-wide animate-drop-banner ${TYPE_STYLES[toast.type] || TYPE_STYLES.default}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
