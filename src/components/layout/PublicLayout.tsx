import { Outlet } from 'react-router-dom'
import { BetaBanner } from '@/components/layout/BetaBanner'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

/** Shell público: banner beta + cabecera + contenido (Outlet) + pie. Rutas no autenticadas. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <BetaBanner />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
