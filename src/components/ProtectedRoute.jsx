import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const { session, loading, signOut } = useAuth()
  const [banned, setBanned] = useState(false)
  const [banChecked, setBanChecked] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) { setBanChecked(true); return }
    supabase
      .from('users')
      .select('is_banned')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setBanned(data?.is_banned ?? false)
        setBanChecked(true)
      })
  }, [session?.user?.id])

  if (loading || !banChecked) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  if (banned) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-8 text-center" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        <p className="text-5xl mb-6">🚫</p>
        <h1 className="text-paper text-2xl italic mb-3" style={{ fontFamily: "'Fraunces', serif" }}>
          Account suspended
        </h1>
        <p className="text-paper/40 text-sm leading-relaxed mb-8 max-w-xs">
          Your account has been suspended. If you think this is a mistake, reach out to us.
        </p>
        <button
          onClick={signOut}
          className="text-paper/30 text-xs font-mono border border-paper/20 px-4 py-2 hover:border-paper/40 hover:text-paper/50 transition-colors tracking-widest uppercase"
        >
          Sign out
        </button>
      </div>
    )
  }

  return children
}
