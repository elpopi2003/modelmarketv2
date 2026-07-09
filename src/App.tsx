import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import Index from '@/pages/Index'
import NotFound from '@/pages/NotFound'

// Rutas pesadas: lazy. La home (Index) va eager por ser el punto de entrada.
const Explorar = lazy(() => import('@/pages/Explorar'))

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
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
