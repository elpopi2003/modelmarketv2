import { BadgeCheck } from 'lucide-react'
import type { SubscriptionTier } from '@/lib/subscription'
import { getCapabilities } from '@/lib/subscription'
import { cn } from '@/lib/utils'

/**
 * Distintivo de vendedor verificado. Lo lucen los planes de pago, que es lo que la
 * matriz de suscripciones llama `hasBadge`: la condición vive ahí y no repetida aquí,
 * para que añadir un plan futuro no obligue a tocar este componente.
 */
export function VerifiedSeller({
  tier,
  className,
}: {
  tier: SubscriptionTier | undefined
  className?: string
}) {
  if (!tier || !getCapabilities(tier).hasBadge) return null
  return (
    <span title="Vendedor verificado" className={cn('inline-flex items-center', className)}>
      <BadgeCheck className="size-4 text-sealed" aria-hidden />
      <span className="sr-only">Vendedor verificado</span>
    </span>
  )
}
