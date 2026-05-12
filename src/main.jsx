import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { useOnline } from './hooks/useOnline'
import Login from './screens/Login'
import AuthCallback from './screens/AuthCallback'
import JoinViaInvite from './screens/JoinViaInvite'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import QuestDrop from './screens/QuestDrop'
import Nearby from './screens/Nearby'
import Memory from './screens/Memory'
import Journal from './screens/Journal'
import Feed from './screens/Feed'
import Friends from './screens/Friends'
import ActiveQuest from './screens/ActiveQuest'
import Admin from './screens/Admin'
import Settings from './screens/Settings'
import ProtectedRoute from './components/ProtectedRoute'
import InstallBanner from './components/InstallBanner'
import TabBar from './components/TabBar'
import { AppStateProvider } from './context/AppState'
import { ToastProvider } from './context/ToastContext'
import { useAuth } from './hooks/useAuth'
import { usePartyInvites } from './hooks/usePartyInvites'
import './index.css'

function PartyInviteListener() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pendingInvite, setPendingInvite] = useState(null)

  usePartyInvites(user?.id, (invite) => {
    setPendingInvite(invite)
    // Auto-dismiss after 30 seconds
    setTimeout(() => setPendingInvite(null), 30000)
  })

  if (!pendingInvite) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-dark border border-rust/40 rounded-xl p-4 shadow-xl" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      <p className="text-paper text-sm mb-3">
        <span className="text-rust font-medium">{pendingInvite.fromName}</span> invited you to quest together
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { navigate('/active-quest'); setPendingInvite(null) }}
          className="flex-1 bg-rust text-dark text-xs font-mono py-2 rounded-lg tracking-widest uppercase"
        >
          Join
        </button>
        <button
          onClick={() => setPendingInvite(null)}
          className="flex-1 border border-paper/20 text-paper/60 text-xs font-mono py-2 rounded-lg tracking-widest uppercase"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

function OfflineBanner() {
  const { isOnline } = useOnline()
  if (isOnline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-gold/90 text-dark text-center text-xs font-mono py-2 tracking-widest uppercase">
      No connection — showing cached data
    </div>
  )
}

function AppShell({ children }) {
  const location = useLocation()
  const showTabBar = ['/home', '/feed', '/journal', '/friends'].includes(location.pathname)
  return (
    <>
      <OfflineBanner />
      {children}
      <PartyInviteListener />
      {showTabBar && <TabBar />}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <AppStateProvider>
            <AppShell>
            <InstallBanner />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/join/:code" element={<JoinViaInvite />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quest-drop"
              element={
                <ProtectedRoute>
                  <QuestDrop />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nearby"
              element={
                <ProtectedRoute>
                  <Nearby />
                </ProtectedRoute>
              }
            />
            <Route
              path="/memory"
              element={
                <ProtectedRoute>
                  <Memory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <Journal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <Friends />
                </ProtectedRoute>
              }
            />
            <Route
              path="/active-quest"
              element={
                <ProtectedRoute>
                  <ActiveQuest />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Routes>
            </AppShell>
          </AppStateProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
)
