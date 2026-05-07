import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

async function resolveDestination(userId) {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  return data ? '/home' : '/onboarding'
}

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const dest = await resolveDestination(session.user.id)
        navigate(dest, { replace: true })
      } else {
        // Token exchange happens via onAuthStateChange when Supabase
        // processes the URL hash on load — wait for it.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (session) {
              subscription.unsubscribe()
              const dest = await resolveDestination(session.user.id)
              navigate(dest, { replace: true })
            }
          }
        )
        return () => subscription.unsubscribe()
      }
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
        <p className="text-paper/40 text-sm tracking-widest uppercase">Signing in…</p>
      </div>
    </div>
  )
}
