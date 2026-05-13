/**
 * Shared wrapper for all admin pages.
 * Handles auth check, admin gate, header, and tab nav.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const TABS = [
  { label: 'Home',       path: '/admin' },
  { label: 'Quests',     path: '/admin/quests' },
  { label: 'Users',      path: '/admin/users' },
  { label: 'Logs',       path: '/admin/logs' },
  { label: 'Moderation', path: '/admin/moderation' },
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user) return
    const envAdmin = user.email === import.meta.env.VITE_ADMIN_EMAIL
    if (envAdmin) { setIsAdmin(true); setChecked(true); return }
    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.is_admin) setIsAdmin(true)
        setChecked(true)
      })
  }, [user])

  if (!user || !checked) return null

  if (!isAdmin) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-paper/40 font-mono text-sm">Access denied.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark text-paper" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-paper/10">
        <div>
          <h1 className="text-rust italic text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>Admin</h1>
          <p className="text-paper/30 text-xs font-mono">{user.email}</p>
        </div>
        <button
          onClick={signOut}
          className="text-paper/40 text-xs font-mono border border-paper/20 px-3 py-1 hover:border-rust hover:text-rust transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-paper/10 px-6">
        {TABS.map(tab => {
          const active = pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`text-xs font-mono tracking-widest uppercase px-4 py-3 border-b-2 transition-colors ${
                active
                  ? 'border-rust text-rust'
                  : 'border-transparent text-paper/40 hover:text-paper/60'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Page content — rendered by child routes */}
      <div className="p-6">
        <Outlet context={{ user }} />
      </div>
    </div>
  )
}
