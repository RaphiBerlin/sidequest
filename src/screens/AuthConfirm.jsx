import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthConfirm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (!token_hash || !type) {
      navigate('/', { replace: true })
      return
    }

    supabase.auth.verifyOtp({ token_hash, type }).then(async ({ data, error }) => {
      if (error || !data.session) {
        navigate('/?error=confirmation_failed', { replace: true })
        return
      }
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.session.user.id)
        .maybeSingle()
      navigate(profile ? '/home' : '/onboarding', { replace: true })
    })
  }, [])

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-paper/20 border-t-rust rounded-full animate-spin" />
        <p className="text-paper/40 text-sm tracking-widest uppercase">Confirming…</p>
      </div>
    </div>
  )
}
