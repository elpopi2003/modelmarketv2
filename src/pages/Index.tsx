import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** Landing pública. Se carga de forma eager (es la home). */
export default function Index() {
  return (
    <section className="grid place-items-center px-6 py-24 text-center">
      <div className="max-w-xl space-y-6">
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          0% de comisión entre coleccionistas
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">ModelMarket</h1>
        <p className="text-lg text-muted-foreground">
          El marketplace para maquetas y modelos a escala. Compra, vende e intercambia sin comisiones.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/explorar">Explorar anuncios</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/peticiones">Crear petición</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
