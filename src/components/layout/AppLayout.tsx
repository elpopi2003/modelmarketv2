import { Outlet } from 'react-router-dom'
import { BetaBanner } from '@/components/layout/BetaBanner'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'

/** Shell autenticado. Mismo chrome que el público; la cabecera adapta sus acciones
 *  al estado de sesión. Se usa tras el guard RequireAuth. */
export function AppLayout() {
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
