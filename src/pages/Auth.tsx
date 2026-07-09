import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from '@/lib/schemas/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setServerError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setServerError(error)
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
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <FieldError message={serverError ?? undefined} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const { signUp } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
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
    setDone(true)
  }

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        Cuenta creada. Revisa tu email para confirmar el registro.
      </p>
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
      <FieldError message={serverError ?? undefined} />
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
    <div className="grid min-h-dvh place-items-center bg-background px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</CardTitle>
          <CardDescription>ModelMarket — 0% de comisión entre coleccionistas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  )
}
