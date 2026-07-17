import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/utils'

/**
 * Marca de ModelMarket: logotipo oficial (emblema de vehículos + wordmark + claim
 * "Nada de comisiones, sólo maquetas" integrados en la imagen).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="ModelMarket — Nada de comisiones, sólo maquetas"
      className={cn('h-10 w-auto', className)}
    />
  )
}
