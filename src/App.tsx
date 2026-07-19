import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireAdmin } from '@/components/auth/RequireAdmin'
import Index from '@/pages/Index'
import Auth from '@/pages/Auth'
import AuthCallback from '@/pages/AuthCallback'
import NotFound from '@/pages/NotFound'

// Rutas pesadas: lazy. La home (Index) y Auth van eager por ser puntos de entrada.
const Explorar = lazy(() => import('@/pages/Explorar'))
const Producto = lazy(() => import('@/pages/Producto'))
const Peticiones = lazy(() => import('@/pages/Peticiones'))
const Peticion = lazy(() => import('@/pages/Peticion'))
const Precios = lazy(() => import('@/pages/Precios'))
const Terminos = lazy(() => import('@/pages/legal/Terminos'))
const Privacidad = lazy(() => import('@/pages/legal/Privacidad'))
const Cookies = lazy(() => import('@/pages/legal/Cookies'))
const Faq = lazy(() => import('@/pages/Faq'))
const CrearPeticion = lazy(() => import('@/pages/CrearPeticion'))
const MisPeticiones = lazy(() => import('@/pages/MisPeticiones'))
const EditarPeticion = lazy(() => import('@/pages/EditarPeticion'))
const Favoritos = lazy(() => import('@/pages/Favoritos'))
const Mensajes = lazy(() => import('@/pages/Mensajes'))
const Notificaciones = lazy(() => import('@/pages/Notificaciones'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Ofertas = lazy(() => import('@/pages/Ofertas'))
const Perfil = lazy(() => import('@/pages/Perfil'))
const Configuracion = lazy(() => import('@/pages/Configuracion'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminReportes = lazy(() => import('@/pages/admin/AdminReportes'))
const AdminUsuarios = lazy(() => import('@/pages/admin/AdminUsuarios'))
const AdminContenido = lazy(() => import('@/pages/admin/AdminContenido'))
const PublicarAnuncio = lazy(() => import('@/pages/PublicarAnuncio'))
const EditarAnuncio = lazy(() => import('@/pages/EditarAnuncio'))

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Cargando…</div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Index />} />
          <Route path="explorar" element={<Explorar />} />
          <Route path="producto/:id" element={<Producto />} />
          <Route path="peticiones" element={<Peticiones />} />
          <Route path="peticion/:id" element={<Peticion />} />
          <Route path="precios" element={<Precios />} />
          <Route path="terminos" element={<Terminos />} />
          <Route path="privacidad" element={<Privacidad />} />
          <Route path="cookies" element={<Cookies />} />
          <Route path="faq" element={<Faq />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="auth" element={<Auth />} />
        <Route path="auth/callback" element={<AuthCallback />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="ofertas" element={<Ofertas />} />
            <Route path="publicar" element={<PublicarAnuncio />} />
            <Route path="crear-peticion" element={<CrearPeticion />} />
            <Route path="mis-peticiones" element={<MisPeticiones />} />
            <Route path="peticion/:id/editar" element={<EditarPeticion />} />
            <Route path="favoritos" element={<Favoritos />} />
            <Route path="mensajes" element={<Mensajes />} />
            <Route path="mensajes/:id" element={<Mensajes />} />
            <Route path="notificaciones" element={<Notificaciones />} />
            <Route path="anuncio/:id/editar" element={<EditarAnuncio />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="configuracion" element={<Configuracion />} />

            {/* Panel de administración: además del guard, la BD comprueba el rol. */}
            <Route element={<RequireAdmin />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/reportes" element={<AdminReportes />} />
              <Route path="admin/usuarios" element={<AdminUsuarios />} />
              <Route path="admin/contenido" element={<AdminContenido />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
