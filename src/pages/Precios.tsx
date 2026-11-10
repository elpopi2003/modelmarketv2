import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePlatform } from '@/hooks/usePlatform'
import { useCheckout } from '@/hooks/useSubscription'
import {
  SUBSCRIPTION_TIERS,
  TIER_CAPABILITIES,
  isUnlimited,
  type SubscriptionTier,
} from '@/lib/subscription'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Seo } from '@/components/seo/Seo'

/**
 * Planes que se ofrecen en la página de precios. Retail se excluye de la venta pública:
 * el tier sigue existiendo en el modelo de datos, en el panel de administración y en
 * Stripe (para quien ya lo tuviera), pero no se ofrece aquí para contratar.
 */
const PRICING_TIERS = SUBSCRIPTION_TIERS.filter((tier) => tier !== 'retail')

function priceLabel(priceMonthly: number): string {
  if (priceMonthly === 0) return 'Gratis'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(priceMonthly)
}

function featureRows(tier: SubscriptionTier) {
  const c = TIER_CAPABILITIES[tier]
  const limit = (n: number, unlimited: string) => (isUnlimited(n) ? unlimited : String(n))
  return [
    { label: 'Anuncios activos', value: limit(c.maxListings, 'Ilimitados') },
    { label: 'Peticiones activas', value: limit(c.maxRequests, 'Ilimitadas') },
    { label: 'Fotos por anuncio', value: limit(c.maxPhotosPerItem, 'Ilimitadas') },
    {
      label: 'Visibilidad',
      value: c.immediateVisibility ? 'Inmediata' : `Retardada ${c.visibilityDelayHours}h`,
    },
    { label: 'Insignia de plan', value: c.hasBadge },
  ]
}

export default function Precios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const checkout = useCheckout()
  const { betaAllPro } = usePlatform()
  const [notice, setNotice] = useState<string | null>(null)

  function handleSubscribe(tier: SubscriptionTier) {
    if (!user) {
      navigate('/auth')
      return
    }
    setNotice(null)
    // create-checkout redirige a Stripe; en caso de error (p. ej. sin desplegar) lo mostramos.
    checkout.mutate(tier, { onError: (e) => setNotice(getErrorMessage(e)) })
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <Seo
        title="Planes y precios"
        description="Vende y compra con 0% de comisión. Empieza gratis o hazte PRO para anuncios ilimitados, más fotos y visibilidad inmediata."
      />
      <div className="mb-10 text-center">
        <div className="mm-section-header justify-center">
          <span className="mm-section-header__label">Planes</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Elige tu plan</h1>
        <p className="mt-3 text-muted-foreground">
          Vende y compra con{' '}
          <span className="mm-underline-accent font-semibold">0% de comisión</span>. Mejora solo
          cuando lo necesites.
        </p>
      </div>

      {betaAllPro && (
        <div
          role="status"
          className="mx-auto mb-8 max-w-3xl rounded-md border-2 border-accent bg-accent/10 p-4 text-center"
        >
          <p className="font-display text-lg font-extrabold">Beta: PRO gratis para todos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mientras dure la beta, todas las cuentas tienen las ventajas PRO sin pagar nada. Te
            avisaremos con tiempo antes de que lleguen los planes de pago.
          </p>
        </div>
      )}

      {notice && (
        <p className="mb-6 rounded-md border border-border bg-muted p-3 text-center text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        {PRICING_TIERS.map((tier) => {
          const c = TIER_CAPABILITIES[tier]
          const highlighted = tier === 'pro'
          const isFree = tier === 'free'
          return (
            <div
              key={tier}
              className={cn(
                'flex flex-col rounded-md border-2 bg-card p-6',
                highlighted ? 'border-accent shadow-lg' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
                  {c.label}
                </h2>
                {highlighted && (
                  <span className="mm-mono rounded-md bg-accent px-2 py-0.5 text-xs font-semibold uppercase text-accent-ink">
                    Popular
                  </span>
                )}
              </div>

              <p className="mt-4">
                <span className="mm-mono text-3xl font-bold">{priceLabel(c.priceMonthly)}</span>
                {c.priceMonthly > 0 && <span className="text-sm text-muted-foreground"> /mes</span>}
              </p>

              <div className="mt-6">
                {isFree ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to={user ? '/dashboard' : '/auth'}>
                      {user ? (betaAllPro ? 'Ir a mi panel' : 'Tu plan base') : 'Empezar gratis'}
                    </Link>
                  </Button>
                ) : betaAllPro ? (
                  <Button asChild variant={highlighted ? 'accent' : 'default'} className="w-full">
                    <Link to={user ? '/dashboard' : '/auth'}>
                      {user ? 'Ya lo tienes en la beta' : 'Pruébalo gratis'}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant={highlighted ? 'accent' : 'default'}
                    className="w-full"
                    disabled={checkout.isPending}
                    onClick={() => handleSubscribe(tier)}
                  >
                    {checkout.isPending ? 'Redirigiendo…' : `Hazte ${c.label}`}
                  </Button>
                )}
              </div>

              <ul className="mt-6 space-y-3 text-sm">
                {featureRows(tier).map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    {typeof row.value === 'boolean' ? (
                      row.value ? (
                        <Check className="size-4 text-sealed-ink" aria-label="Sí" />
                      ) : (
                        <Minus className="size-4 text-muted-foreground" aria-label="No" />
                      )
                    ) : (
                      <span className="mm-mono font-semibold">{row.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
