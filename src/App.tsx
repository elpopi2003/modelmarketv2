import { Routes, Route } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function Home() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-center">
      <div className="max-w-xl space-y-6">
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          0% de comisión entre coleccionistas
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">ModelMarket</h1>
        <p className="text-lg text-muted-foreground">
          El marketplace para maquetas y modelos a escala. Andamiaje <strong>M0</strong> listo — el
          resto se construye por hitos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button>Explorar anuncios</Button>
          <Button variant="outline">Crear petición</Button>
        </div>
      </div>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

export default App
