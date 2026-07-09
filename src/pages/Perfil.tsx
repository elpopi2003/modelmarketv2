import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useProfile } from '@/hooks/useProfile'
import { profileSchema, type ProfileFormValues } from '@/lib/schemas/profile'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Convierte '' a null para no chocar con el unique de username y no guardar cadenas vacías. */
function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export default function Perfil() {
  const { profile, isLoading, updateProfile, isUpdating } = useProfile()
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) })

  // Rellena el formulario cuando llega el perfil.
  useEffect(() => {
    if (profile) {
      reset({
        display_name: profile.display_name ?? '',
        username: profile.username ?? '',
        bio: profile.bio ?? '',
      })
    }
  }, [profile, reset])

  async function onSubmit(values: ProfileFormValues) {
    setStatus(null)
    try {
      await updateProfile({
        display_name: emptyToNull(values.display_name),
        username: emptyToNull(values.username),
        bio: emptyToNull(values.bio),
      })
      setStatus({ kind: 'ok', message: 'Perfil guardado.' })
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Tu perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Datos públicos</CardTitle>
          <CardDescription>Esta información es visible para otros coleccionistas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando perfil…</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="display_name">Nombre para mostrar</Label>
                <Input id="display_name" {...register('display_name')} />
                {errors.display_name && (
                  <p className="text-sm text-destructive">{errors.display_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input id="username" placeholder="p. ej. escala_1_72" {...register('username')} />
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Sobre ti</Label>
                <textarea
                  id="bio"
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('bio')}
                />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              {status && (
                <p
                  className={
                    status.kind === 'ok'
                      ? 'text-sm text-muted-foreground'
                      : 'text-sm text-destructive'
                  }
                >
                  {status.message}
                </p>
              )}

              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
