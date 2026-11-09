import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Marco común de las pantallas de cuenta (entrar, confirmar email, recuperar contraseña):
 * logo que vuelve al inicio y una tarjeta centrada.
 */
export function AuthShell({
  title,
  description = 'ModelMarket — 0% de comisión entre coleccionistas.',
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center" aria-label="Volver al inicio">
          <Logo className="h-14" />
        </Link>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Mensaje de error o de éxito bajo un formulario de cuenta. */
export function AuthNotice({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
    >
      {children}
    </p>
  )
}
