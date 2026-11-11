import { cn } from '@/lib/utils'

/**
 * Banda roja en diagonal (45°) con «¡VENDIDA!» que cruza la foto de un anuncio vendido.
 * El contenedor padre debe ser `relative`; esta capa recorta la banda a sus bordes y no
 * captura clics (la tarjeta sigue llevando a la ficha).
 */
export function SoldRibbon({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <span
        className={cn(
          // 150 %: a 45° la banda tiene que cubrir la diagonal de una foto 4:3 de lado a lado.
          'mm-sold-ribbon w-[150%] shrink-0',
          size === 'lg' ? 'py-3.5 text-2xl sm:text-3xl' : 'py-2 text-base',
        )}
      >
        ¡Vendida!
      </span>
    </div>
  )
}
