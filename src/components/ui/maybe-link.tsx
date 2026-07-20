import { Link } from 'react-router-dom'

/**
 * Enlaza si hay destino; si no, pinta el contenido sin más.
 *
 * Para asuntos (anuncio/petición) que pueden haber desaparecido para quien mira: borrados
 * o retirados por moderación. Un enlace ahí llevaría a "no encontrado", que parece un error
 * de la aplicación cuando en realidad es el comportamiento correcto.
 */
export function MaybeLink({
  to,
  className,
  children,
}: {
  to: string | null
  className?: string
  children: React.ReactNode
}) {
  if (!to) return <span className={className}>{children}</span>
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}
