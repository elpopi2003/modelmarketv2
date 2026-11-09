import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation } from 'react-router-dom'
import { requestPasswordReset } from '@/lib/api/auth'
import { getErrorMessage } from '@/lib/errors'
import { emailOnlySchema, type EmailOnlyValues } from '@/lib/schemas/auth'
import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { Seo } from '@/components/seo/Seo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * "He olvidado mi contraseña". La respuesta es la misma exista o no la cuenta, para no
 * revelar qué emails están registrados.
 */
export default function RecuperarContrasena() {
  const location = useLocation()
  const initialEmail = (location.state as { email?: string } | null)?.email ?? ''
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: initialEmail },
  })

  async function onSubmit({ email }: EmailOnlyValues) {
    setError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email.trim())
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  return (
    <AuthShell
      title="Recupera tu contraseña"
      description="Te enviaremos un enlace para elegir una nueva."
    >
      <Seo title="Recuperar contraseña" noindex />
      {sentTo ? (
        <>
          <AuthNotice kind="ok">
            Si hay una cuenta con <strong className="text-foreground">{sentTo}</strong>, te hemos
            enviado un enlace. Caduca en 1 hora y solo sirve una vez.
          </AuthNotice>
          <AuthNotice kind="ok">¿No lo encuentras? Mira en la carpeta de spam.</AuthNotice>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="recover-email">Email</Label>
            <Input id="recover-email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <AuthNotice kind="error">{errors.email.message}</AuthNotice>}
          </div>
          {error && <AuthNotice kind="error">{error}</AuthNotice>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/auth" className="underline-offset-4 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </AuthShell>
  )
}
