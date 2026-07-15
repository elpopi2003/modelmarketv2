import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'

type FooterLink = { label: string; to: string }

const EXPLORE_LINKS: FooterLink[] = [
  { label: 'Militar', to: '/explorar' },
  { label: 'Aviación', to: '/explorar' },
  { label: 'Automoción', to: '/explorar' },
  { label: 'Naval', to: '/explorar' },
]

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Términos de uso', to: '/terminos' },
  { label: 'Privacidad', to: '/privacidad' },
  { label: 'Cookies', to: '/cookies' },
  { label: 'Contacto', to: '/contacto' },
  { label: 'Preguntas frecuentes', to: '/faq' },
]

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="font-display text-sm font-extrabold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="text-sm text-muted-foreground transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Pie de página global: marca + columnas de navegación + línea legal. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              El marketplace especializado para coleccionistas de modelismo. Sin comisiones, solo
              pasión.
            </p>
          </div>
          <FooterColumn title="Explorar" links={EXPLORE_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} ModelMarket. Hecho por maquetistas para maquetistas.
          </span>
          <span className="mm-mono uppercase tracking-wider text-accent">
            Nada de comisiones · Sólo maquetas
          </span>
        </div>
      </div>
    </footer>
  )
}
