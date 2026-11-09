import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { resetPassword } from '@/lib/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { passwordSchema, type PasswordFormValues } from '@/lib/schemas/profile'
import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { Seo } from '@/components/seo/Seo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Destino del enlace de recuperación (`/auth/restablecer?token=...`). Al guardar, el
 * servidor cierra el resto de sesiones e inicia una nueva aquí.
 */
export default function RestablecerContrasena() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [doneWithoutSession, setDoneWithoutSession] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  async function onSubmit({ password }: PasswordFormValues) {
    setError(null)
    try {
      const { loggedIn } = await resetPassword(token, password)
      if (!loggedIn) {
        // Contraseña cambiada, pero la cuenta está suspendida: no hay sesión que abrir.
        setDoneWithoutSession(true)
        return
      }
      await refresh()
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <AuthShell title="Elige una contraseña nueva" description="Mínimo 8 caracteres.">
      <Seo title="Nueva contraseña" noindex />
      {!token ? (
        <>
          <AuthNotice kind="error">Falta el enlace de recuperación.</AuthNotice>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/recuperar">Pedir un enlace</Link>
          </Button>
        </>
      ) : doneWithoutSession ? (
        <AuthNotice kind="ok">
          Contraseña actualizada. Tu cuenta está suspendida, así que no podemos iniciar sesión;
          revisa tu email para conocer el motivo.
        </AuthNotice>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="reset-password">Nueva contraseña</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && <AuthNotice kind="error">{errors.password.message}</AuthNotice>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm">Repite la contraseña</Label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              {...register('confirm')}
            />
            {errors.confirm && <AuthNotice kind="error">{errors.confirm.message}</AuthNotice>}
          </div>
          {error && (
            <>
              <AuthNotice kind="error">{error}</AuthNotice>
              <Link
                to="/auth/recuperar"
                className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Pedir un enlace nuevo
              </Link>
            </>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar y entrar'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
