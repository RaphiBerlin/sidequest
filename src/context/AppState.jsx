import { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TimeoutModal from '../components/TimeoutModal'
import { useFreeze } from '../lib/streak'
import { useAuth } from '../hooks/useAuth'
import { useToast } from './ToastContext'

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [currentQuestSession, setCurrentQuestSessionState] = useState(null)
  const [streak, setStreak] = useState(0)
  const [freezeAvailable, setFreezeAvailable] = useState(false)
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)
  const [timeoutTrigger, setTimeoutTrigger] = useState(null)

  function setCurrentQuestSession(session) {
    setCurrentQuestSessionState(session)
  }

  function resetQuest() {
    setCurrentQuestSessionState(null)
    localStorage.removeItem('sq_session_id')
    localStorage.removeItem('sq_session_started_at')
  }

  function showTimeout(trigger) {
    setTimeoutTrigger(trigger)
    setShowTimeoutModal(true)
  }

  function hideTimeout() {
    setShowTimeoutModal(false)
  }

  async function handleUseFreeze() {
    if (user?.id) {
      await useFreeze(user.id)
      showToast('Streak saved! 🧊', 'success')
    }
    hideTimeout()
  }

  function handleClose() {
    resetQuest()
    hideTimeout()
    navigate('/home')
  }

  const value = {
    currentQuestSession,
    streak,
    freezeAvailable,
    showTimeoutModal,
    timeoutTrigger,
    setCurrentQuestSession,
    resetQuest,
    setStreak,
    setFreezeAvailable,
    showTimeout,
    hideTimeout,
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
      <TimeoutModal
        visible={showTimeoutModal}
        trigger={timeoutTrigger}
        freezeAvailable={freezeAvailable}
        onUseFreeze={handleUseFreeze}
        onClose={handleClose}
      />
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
