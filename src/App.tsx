import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import Index from '@/pages/Index'
import Auth from '@/pages/Auth'
import AuthCallback from '@/pages/AuthCallback'
import NotFound from '@/pages/NotFound'

// Rutas pesadas: lazy. La home (Index) y Auth van eager por ser puntos de entrada.
const Explorar = lazy(() => import('@/pages/Explorar'))
const Producto = lazy(() => import('@/pages/Producto'))
const Peticiones = lazy(() => import('@/pages/Peticiones'))
const CrearPeticion = lazy(() => import('@/pages/CrearPeticion'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Perfil = lazy(() => import('@/pages/Perfil'))
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
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="auth" element={<Auth />} />
        <Route path="auth/callback" element={<AuthCallback />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="publicar" element={<PublicarAnuncio />} />
            <Route path="crear-peticion" element={<CrearPeticion />} />
            <Route path="anuncio/:id/editar" element={<EditarAnuncio />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
