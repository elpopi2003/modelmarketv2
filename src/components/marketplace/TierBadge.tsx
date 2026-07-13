import type { SubscriptionTier } from '@/lib/subscription'
import { cn } from '@/lib/utils'

const STYLES: Record<'pro' | 'retail', string> = {
  pro: 'bg-pro/10 text-pro-ink border-pro/30',
  retail: 'bg-primary/10 text-primary border-primary/30',
}

/** Insignia de plan del vendedor. No renderiza nada para Free. */
export function TierBadge({
  tier,
  className,
}: {
  tier: SubscriptionTier | undefined
  className?: string
}) {
  if (tier !== 'pro' && tier !== 'retail') return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide',
        STYLES[tier],
        className,
      )}
    >
      {tier === 'pro' ? 'PRO' : 'Retail'}
    </span>
  )
}
