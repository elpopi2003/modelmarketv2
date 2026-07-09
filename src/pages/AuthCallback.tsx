import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Destino de `emailRedirectTo` / OAuth. El cliente Supabase procesa la sesión de la URL
 * automáticamente (detectSessionInUrl); aquí solo redirigimos cuando ya se resolvió.
 */
export default function AuthCallback() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    navigate(session ? '/dashboard' : '/auth', { replace: true })
  }, [loading, session, navigate])

  return (
    <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
      Verificando tu cuenta…
    </div>
  )
}
