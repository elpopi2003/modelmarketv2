import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { resendVerification } from '@/lib/api/auth'
import { getErrorMessage } from '@/lib/errors'
import {
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from '@/lib/schemas/auth'
import { AuthNotice, AuthShell } from '@/components/auth/AuthShell'
import { Seo } from '@/components/seo/Seo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

/** Botón para volver a pedir el email de confirmación (caducado o perdido). */
function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setState('sending')
    try {
      await resendVerification(email)
      setState('sent')
    } catch (e) {
      setError(getErrorMessage(e))
      setState('error')
    }
  }

  if (state === 'sent') {
    return <AuthNotice kind="ok">Te hemos enviado un enlace nuevo a {email}.</AuthNotice>
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={resend}
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'Enviando…' : 'Reenviar email de confirmación'}
      </Button>
      {state === 'error' && <AuthNotice kind="error">{error}</AuthNotice>}
    </div>
  )
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth()
  const [serverError, setServerError] = useState<{ message: string; code?: string } | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const { error, code } = await signIn(values.email, values.password)
    if (error) {
      setServerError({ message: error, code })
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="login-password">Contraseña</Label>
          <Link
            to="/auth/recuperar"
            state={{ email: getValues('email') }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ¿La has olvidado?
          </Link>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      {serverError && <AuthNotice kind="error">{serverError.message}</AuthNotice>}
      {serverError?.code === 'email_not_confirmed' && (
        <ResendConfirmation email={getValues('email')} />
      )}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const { signUp } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterValues) {
    setServerError(null)
    const { error } = await signUp(values.email, values.password)
    if (error) {
      setServerError(error)
      return
    }
    setSentTo(values.email.trim())
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <AuthNotice kind="ok">
          Te hemos enviado un enlace a <strong className="text-foreground">{sentTo}</strong>. Ábrelo
          para activar tu cuenta; caduca en 24 horas.
        </AuthNotice>
        <AuthNotice kind="ok">
          ¿No lo encuentras? Mira en la carpeta de spam o pide otro.
        </AuthNotice>
        <ResendConfirmation email={sentTo} />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input id="register-email" type="email" autoComplete="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Contraseña</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-confirm">Repite la contraseña</Label>
        <Input
          id="register-confirm"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </div>
      {serverError && <AuthNotice kind="error">{serverError}</AuthNotice>}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  return (
    <AuthShell title={mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}>
      <Seo
        title="Entrar"
        description="Accede a tu cuenta de ModelMarket o crea una nueva."
        noindex
      />
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={cn(
            'rounded px-3 py-1.5 font-medium transition-colors',
            mode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground',
          )}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={cn(
            'rounded px-3 py-1.5 font-medium transition-colors',
            mode === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground',
          )}
        >
          Registrarse
        </button>
      </div>

      {mode === 'login' ? (
        <LoginForm onSuccess={() => navigate(from, { replace: true })} />
      ) : (
        <RegisterForm />
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-4 hover:underline">
          Volver al inicio
        </Link>
      </p>
    </AuthShell>
  )
}
