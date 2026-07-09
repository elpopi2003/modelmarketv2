import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="grid place-items-center px-6 py-24 text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-3xl font-bold tracking-tight">Página no encontrada</h1>
        <p className="text-muted-foreground">La página que buscas no existe o se ha movido.</p>
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          Volver al inicio
        </Link>
      </div>
    </section>
  )
}
