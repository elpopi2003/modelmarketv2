import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Camera,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Save,
  Settings,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { changePassword } from '@/lib/api/auth'
import {
  passwordSchema,
  profileSchema,
  type PasswordFormValues,
  type ProfileFormValues,
} from '@/lib/schemas/profile'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const PROFILE_FORM_ID = 'config-perfil'

function emptyToNull(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function SectionCard({
  Icon,
  title,
  description,
  danger = false,
  children,
}: {
  Icon: typeof User
  title: string
  description: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-lg border-2 bg-card p-6 shadow-sm',
        danger ? 'border-destructive/60' : 'border-border',
      )}
    >
      <div className="mb-5 flex items-start gap-2.5">
        <Icon
          className={cn(
            'mt-1 size-5 shrink-0',
            danger ? 'text-destructive' : 'text-muted-foreground',
          )}
        />
        <div>
          <h2 className={cn('font-display text-xl font-extrabold', danger && 'text-destructive')}>
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/** Interruptor accesible sin dependencias (el proyecto no trae Radix Switch). */
function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-card shadow transition-[left]',
          checked ? 'left-[1.375rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

function PasswordInput({
  id,
  placeholder,
  register,
}: {
  id: string
  placeholder: string
  register: ReturnType<ReturnType<typeof useForm<PasswordFormValues>>['register']>
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={visible ? 'text' : 'password'} placeholder={placeholder} {...register} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export default function Configuracion() {
  const { user, signOut } = useAuth()
  const { profile, isLoading, updateProfile, isUpdating, setAvatar, removeAvatar } = useProfile()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<typeof status>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const profileForm = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) })
  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        display_name: profile.display_name ?? '',
        username: profile.username ?? '',
        location: profile.location ?? '',
        bio: profile.bio ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function onSaveProfile(values: ProfileFormValues) {
    setStatus(null)
    try {
      await updateProfile({
        display_name: emptyToNull(values.display_name),
        username: emptyToNull(values.username),
        location: emptyToNull(values.location),
        bio: emptyToNull(values.bio),
      })
      setStatus({ kind: 'ok', message: 'Cambios guardados.' })
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  async function onPickAvatar(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setAvatarBusy(true)
    setStatus(null)
    try {
      await setAvatar(file)
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    } finally {
      setAvatarBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onToggle(field: 'notify_email' | 'notify_push', value: boolean) {
    setStatus(null)
    try {
      await updateProfile({ [field]: value })
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  async function onChangePassword(values: PasswordFormValues) {
    setPasswordStatus(null)
    try {
      await changePassword(values.password)
      passwordForm.reset({ password: '', confirm: '' })
      setPasswordStatus({
        kind: 'ok',
        message: 'Contraseña actualizada. Hemos cerrado tu sesión en el resto de dispositivos.',
      })
    } catch (error) {
      setPasswordStatus({ kind: 'error', message: getErrorMessage(error) })
    }
  }

  async function onDeleteAccount() {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const { data, error } = await supabase.functions.invoke('delete-account')
      if (error) throw error
      if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo eliminar la cuenta')
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      setDeleteError(getErrorMessage(error))
      setDeleteBusy(false)
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </section>
    )
  }

  const shownName = profile?.display_name || profile?.username || 'U'

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <Link
          to="/dashboard"
          aria-label="Volver al dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <Settings className="size-7" /> Configuración
        </h1>
      </div>

      <div className="space-y-6">
        {/* Perfil */}
        <SectionCard Icon={User} title="Perfil" description="Tu información pública">
          <div className="mb-5 flex items-center gap-4 border-b border-border pb-5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="size-14 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary font-display text-xl font-extrabold text-primary-foreground">
                {shownName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {user?.email && (
                <p className="mb-2 truncate text-sm text-muted-foreground">{user.email}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera /> {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
                </Button>
                {profile?.avatar_url && (
                  <button
                    type="button"
                    onClick={() => void removeAvatar()}
                    aria-label="Quitar foto de perfil"
                    className="text-destructive transition-opacity hover:opacity-80"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickAvatar(e.target.files)}
              />
            </div>
          </div>

          <form
            id={PROFILE_FORM_ID}
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nombre para mostrar</Label>
                <Input id="display_name" {...profileForm.register('display_name')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <Input id="username" {...profileForm.register('username')} />
                {profileForm.formState.errors.username && (
                  <p className="text-sm text-destructive">
                    {profileForm.formState.errors.username.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                placeholder="p. ej. 45003, Toledo"
                {...profileForm.register('location')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                rows={4}
                placeholder="Cuéntanos sobre ti y tus intereses en maquetas…"
                {...profileForm.register('bio')}
              />
              {profileForm.formState.errors.bio && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.bio.message}
                </p>
              )}
            </div>
          </form>
        </SectionCard>

        {/* Notificaciones */}
        <SectionCard
          Icon={Bell}
          title="Notificaciones"
          description="Configura cómo quieres recibir alertas"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-opened/10 text-opened">
                  <Mail className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Notificaciones por email</p>
                  <p className="text-sm text-muted-foreground">
                    Recibe emails cuando te lleguen mensajes nuevos
                  </p>
                </div>
              </div>
              <Switch
                checked={profile?.notify_email ?? true}
                onChange={(v) => void onToggle('notify_email', v)}
                disabled={isUpdating}
                label="Notificaciones por email"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-started/10 text-started">
                  <Smartphone className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Notificaciones push</p>
                  <p className="text-sm text-muted-foreground">
                    Recibe alertas en tu navegador incluso sin tener la app abierta
                  </p>
                </div>
              </div>
              <Switch
                checked={profile?.notify_push ?? false}
                onChange={(v) => void onToggle('notify_push', v)}
                disabled={isUpdating}
                label="Notificaciones push"
              />
            </div>

            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Para recibir notificaciones push, necesitas dar permiso a tu navegador. Al activar
              esta opción, se te pedirá permiso.
            </p>
          </div>
        </SectionCard>

        {/* Contraseña */}
        <SectionCard Icon={Lock} title="Contraseña" description="Cambia tu contraseña de acceso">
          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <PasswordInput
                id="password"
                placeholder="Mínimo 6 caracteres"
                register={passwordForm.register('password')}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <PasswordInput
                id="confirm"
                placeholder="Repite la nueva contraseña"
                register={passwordForm.register('confirm')}
              />
              {passwordForm.formState.errors.confirm && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirm.message}
                </p>
              )}
            </div>
            {passwordStatus && (
              <p
                className={
                  passwordStatus.kind === 'ok'
                    ? 'text-sm text-muted-foreground'
                    : 'text-sm text-destructive'
                }
              >
                {passwordStatus.message}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={passwordForm.formState.isSubmitting}
            >
              <Lock />
              {passwordForm.formState.isSubmitting ? 'Cambiando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </SectionCard>

        {/* Zona de peligro */}
        <SectionCard
          Icon={AlertTriangle}
          title="Zona de peligro"
          description="Acciones irreversibles"
          danger
        >
          <div className="mb-4 rounded-md bg-destructive/10 p-4 text-sm">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-destructive">
              <AlertTriangle className="size-4" /> Eliminar tu cuenta es una acción permanente
            </p>
            <ul className="space-y-1 text-foreground/80">
              <li>· Todos tus anuncios serán eliminados</li>
              <li>· Todas tus peticiones serán eliminadas</li>
              <li>· Tus conversaciones y mensajes se borrarán</li>
              <li>· Tu perfil y datos personales serán eliminados</li>
              <li>· Esta acción NO se puede deshacer</li>
            </ul>
          </div>

          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-destructive">
                ¿Seguro? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteBusy}
                  onClick={() => void onDeleteAccount()}
                >
                  {deleteBusy ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
                </Button>
                <Button
                  variant="outline"
                  disabled={deleteBusy}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 /> Eliminar mi cuenta
            </Button>
          )}
          {deleteError && <p className="mt-2 text-sm text-destructive">{deleteError}</p>}
        </SectionCard>

        {status && (
          <p
            className={
              status.kind === 'ok' ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'
            }
          >
            {status.message}
          </p>
        )}

        <Button
          type="submit"
          form={PROFILE_FORM_ID}
          className="w-full"
          size="lg"
          disabled={isUpdating}
        >
          <Save />
          {isUpdating ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </section>
  )
}
