import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { CircleCheck, Mail, Send } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { contactSchema, type ContactFormValues } from '@/lib/schemas/contact'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const MAX_MESSAGE = 2000

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export default function Contacto() {
  const { user } = useAuth()
  const { getToken } = useRecaptcha()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    // Si hay sesión, se rellena el email: una fricción menos.
    defaultValues: { name: '', email: user?.email ?? '', subject: '', message: '' },
  })

  const messageLength = watch('message')?.length ?? 0

  async function onSubmit(values: ContactFormValues) {
    setServerError(null)
    try {
      const token = await getToken('contact')
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: { ...values, recaptchaToken: token },
      })
      if (error) throw error
      if (data && data.ok === false) throw new Error(data.error ?? 'No se pudo enviar el mensaje')
      setSent(true)
    } catch (e) {
      setServerError(getErrorMessage(e))
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Contacto</h1>
      <p className="mt-2 text-muted-foreground">
        ¿Tienes alguna duda, sugerencia o problema? Escríbenos y te responderemos lo antes posible.
      </p>

      {sent ? (
        <div className="mt-8 rounded-lg border-2 border-sealed/40 bg-sealed/10 p-8 text-center">
          <CircleCheck className="mx-auto mb-3 size-10 text-sealed" />
          <h2 className="font-display text-lg font-extrabold">Mensaje enviado</h2>
          <p className="mt-2 text-muted-foreground">
            Gracias por escribirnos. Te responderemos lo antes posible.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Asunto</Label>
            <Input id="subject" {...register('subject')} />
            <FieldError message={errors.subject?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="message">Mensaje</Label>
              <span className="mm-mono text-xs text-muted-foreground">
                {messageLength}/{MAX_MESSAGE}
              </span>
            </div>
            <Textarea id="message" rows={7} maxLength={MAX_MESSAGE} {...register('message')} />
            <FieldError message={errors.message?.message} />
          </div>

          <p className="text-xs text-muted-foreground">
            Este formulario está protegido por reCAPTCHA. Al enviarlo aceptas nuestra{' '}
            <Link to="/privacidad" className="underline underline-offset-2">
              Política de Privacidad
            </Link>
            .
          </p>

          <FieldError message={serverError ?? undefined} />

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={isSubmitting}>
            <Send />
            {isSubmitting ? 'Enviando…' : 'Enviar mensaje'}
          </Button>
        </form>
      )}

      <div className="mt-10 rounded-lg border-2 border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">También puedes escribirnos directamente a</p>
        <a
          href="mailto:info@modelmarket.es"
          className="mt-1 inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"
        >
          <Mail className="size-4" /> info@modelmarket.es
        </a>
      </div>
    </section>
  )
}
