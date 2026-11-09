import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearchParams } from 'react-router-dom'
import { resendVerification, verifyEmail } from '@/lib/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { emailOnlySchema, type EmailOnlyValues } from '@/lib/schemas/auth'
import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { Seo } from '@/components/seo/Seo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type State = { kind: 'verifying' } | { kind: 'ok' } | { kind: 'error'; message: string }

/**
 * Destino del enlace del email de alta (`/auth/verificar?token=...`). Confirmar el email
 * no inicia sesión: después, la persona entra con su contraseña.
 */
export default function VerificarEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>(
    token ? { kind: 'verifying' } : { kind: 'error', message: 'Falta el enlace de confirmación.' },
  )
  // El enlace es de un solo uso: en desarrollo React monta dos veces los efectos y el
  // segundo intento lo daría por gastado.
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setState({ kind: 'ok' }))
      .catch((e) => setState({ kind: 'error', message: getErrorMessage(e) }))
  }, [token])

  return (
    <AuthShell
      title={state.kind === 'ok' ? 'Email confirmado' : 'Confirmar email'}
      description="Activa tu cuenta de ModelMarket."
    >
      <Seo title="Confirmar email" noindex />
      {state.kind === 'verifying' && <AuthNotice kind="ok">Confirmando tu email…</AuthNotice>}

      {state.kind === 'ok' && (
        <>
          <AuthNotice kind="ok">
            Tu cuenta ya está activa. Entra con tu email y contraseña.
          </AuthNotice>
          <Button asChild className="w-full">
            <Link to="/auth">Entrar</Link>
          </Button>
        </>
      )}

      {state.kind === 'error' && (
        <>
          <AuthNotice kind="error">{state.message}</AuthNotice>
          <ResendForm />
        </>
      )}
    </AuthShell>
  )
}

function ResendForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyValues>({ resolver: zodResolver(emailOnlySchema) })

  async function onSubmit({ email }: EmailOnlyValues) {
    setError(null)
    try {
      await resendVerification(email)
      setSentTo(email.trim())
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  if (sentTo) {
    return (
      <AuthNotice kind="ok">
        Si {sentTo} tiene una cuenta pendiente de confirmar, te hemos enviado un enlace nuevo.
      </AuthNotice>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <p className="text-sm text-muted-foreground">Pide un enlace nuevo con tu email:</p>
      <div className="space-y-2">
        <Label htmlFor="resend-email">Email</Label>
        <Input id="resend-email" type="email" autoComplete="email" {...register('email')} />
        {errors.email && <AuthNotice kind="error">{errors.email.message}</AuthNotice>}
      </div>
      {error && <AuthNotice kind="error">{error}</AuthNotice>}
      <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando…' : 'Enviar enlace nuevo'}
      </Button>
    </form>
  )
}
