import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

interface FaqGroup {
  group: string
  items: { q: string; a: string }[]
}

const FAQ: FaqGroup[] = [
  {
    group: 'General',
    items: [
      {
        q: '¿Qué es ModelMarket?',
        a: 'ModelMarket es un marketplace especializado en modelismo estático (maquetas a escala). Conectamos a coleccionistas, maquetistas y vendedores de todo tipo de kits: militar, aviación, automoción, naval y accesorios como fotograbados, resinas y calcas.',
      },
      {
        q: '¿Es gratuito usar ModelMarket?',
        a: 'Sí. Puedes registrarte y empezar a comprar y vender gratis. El plan gratuito incluye 1 anuncio activo, 1 petición activa y 2 fotos por anuncio. Si necesitas más, existe el plan PRO.',
      },
      {
        q: '¿Cobráis comisión por las ventas?',
        a: 'No, nunca. ModelMarket no cobra ningún porcentaje sobre tus ventas. El vendedor recibe el 100% del precio acordado con el comprador. Solo el plan PRO tiene una cuota mensual fija opcional.',
      },
    ],
  },
  {
    group: 'Comprar',
    items: [
      {
        q: '¿Cómo compro una maqueta?',
        a: 'Navega por los anuncios en la sección Explorar o usa el buscador. Cuando encuentres algo que te interese, contacta al vendedor a través del chat integrado para acordar precio y forma de envío o entrega.',
      },
      {
        q: '¿Puedo hacer ofertas a los vendedores?',
        a: 'Sí, si el vendedor ha activado la opción «Acepta ofertas» en su anuncio, podrás enviarle una propuesta de precio diferente al publicado.',
      },
      {
        q: '¿Qué son las peticiones?',
        a: 'Las peticiones te permiten publicar lo que buscas para que los vendedores te encuentren a ti. Describe la maqueta que necesitas, el presupuesto máximo y las condiciones que aceptas, y los vendedores interesados se pondrán en contacto contigo.',
      },
    ],
  },
  {
    group: 'Vender',
    items: [
      {
        q: '¿Cómo publico un anuncio?',
        a: 'Regístrate, haz clic en «Publicar» y rellena los datos de tu maqueta: título, descripción, escala, marca, estado, precio y fotos. Tu anuncio estará visible en cuanto lo publiques (inmediatamente si eres PRO, o tras 24 horas si estás en el plan gratuito).',
      },
      {
        q: '¿Cuántas fotos puedo subir por anuncio?',
        a: 'Con el plan gratuito puedes subir hasta 2 fotos por anuncio. Con el plan PRO, hasta 5 fotos para mostrar tu maqueta con más detalle.',
      },
      {
        q: '¿Puedo marcar un anuncio como reservado?',
        a: 'Sí. Desde el panel de tu anuncio puedes alternar el estado «Reservado» para indicar que ya tienes un comprador interesado pero la venta aún no se ha completado.',
      },
      {
        q: '¿Qué métodos de entrega están disponibles?',
        a: 'Al publicar un anuncio debes seleccionar el método de entrega: «Envíos disponibles» si realizas envíos, o «Únicamente entrega en mano» si solo entregas en persona. Los compradores pueden filtrar por este criterio.',
      },
    ],
  },
  {
    group: 'Planes y Suscripciones',
    items: [
      {
        q: '¿Qué diferencias hay entre el plan Gratis y el PRO?',
        a: 'El plan Gratis incluye 1 anuncio, 1 petición y 2 fotos por anuncio, con visibilidad a las 24h de la publicación. El plan PRO ofrece anuncios y peticiones ilimitadas, 5 fotos por anuncio, visibilidad inmediata, prioridad en los resultados de búsqueda e insignia de vendedor verificado.',
      },
      {
        q: '¿Cuánto cuesta el plan PRO?',
        a: 'El plan PRO tiene un precio de 4,99€/mes. Sin permanencia ni compromisos.',
      },
      {
        q: '¿Puedo cancelar el plan PRO en cualquier momento?',
        a: 'Sí, puedes cancelar cuando quieras. Mantendrás los beneficios PRO hasta el final del periodo facturado.',
      },
      {
        q: '¿Qué pasa con mis anuncios si cancelo el plan PRO?',
        a: 'Tus anuncios existentes seguirán activos, pero no podrás crear nuevos si superas el límite del plan gratuito (1 anuncio activo). Las fotos adicionales de anuncios existentes se mantendrán.',
      },
    ],
  },
  {
    group: 'Envíos',
    items: [
      {
        q: '¿ModelMarket gestiona los envíos?',
        a: 'Todavía no, pero estamos trabajando en ello. Actualmente nos encontramos en proceso de estudio y contratación de una plataforma de envíos segura y fiable que se integre directamente en ModelMarket.',
      },
      {
        q: '¿Qué funcionalidades tendrá el servicio de envíos?',
        a: 'Nuestra intención es que puedas gestionar todo el proceso de envío desde la propia página: generar etiquetas de envío, realizar el seguimiento del paquete y pagar el servicio de forma cómoda y segura a través de Stripe, sin salir de ModelMarket.',
      },
      {
        q: '¿Tendrá algún sobrecoste por parte de ModelMarket?',
        a: 'No. El coste del envío será exclusivamente el que establezca la plataforma de transporte. ModelMarket no aplicará ningún recargo ni comisión adicional sobre el precio del servicio de envío.',
      },
      {
        q: '¿Cuándo estará disponible?',
        a: 'Estamos evaluando las mejores opciones para ofrecer un servicio de calidad. Anunciaremos la fecha de lanzamiento en cuanto tengamos todo listo. Mientras tanto, vendedores y compradores pueden acordar el método de envío directamente a través del chat.',
      },
    ],
  },
  {
    group: 'Visibilidad y Búsqueda',
    items: [
      {
        q: '¿Cuándo será visible mi anuncio para otros usuarios?',
        a: 'Si tienes el plan PRO, tu anuncio será visible inmediatamente. Con el plan gratuito, tu anuncio aparecerá para el resto de usuarios 24 horas después de publicarlo. Tú siempre podrás verlo desde tu dashboard.',
      },
      {
        q: '¿Qué significa «Prioridad en resultados»?',
        a: 'Los anuncios y peticiones de usuarios PRO se muestran siempre por delante de los de usuarios del plan gratuito en los listados y resultados de búsqueda, ordenados por fecha de publicación.',
      },
    ],
  },
  {
    group: 'Seguridad y Cuenta',
    items: [
      {
        q: '¿Cómo puedo reportar un anuncio sospechoso?',
        a: 'En cada anuncio encontrarás la opción de «Reportar». Selecciona el motivo y nuestro equipo lo revisará lo antes posible.',
      },
      {
        q: '¿Puedo eliminar mi cuenta?',
        a: 'Sí, puedes solicitar la eliminación de tu cuenta desde la sección de Configuración. Se eliminarán todos tus datos, anuncios y conversaciones de forma permanente.',
      },
      {
        q: '¿Cómo contacto con el equipo de ModelMarket?',
        a: 'Puedes escribirnos a info@modelmarket.es o usar el formulario de contacto disponible en la web.',
      },
    ],
  },
]

/** Acordeón nativo: <details> aporta accesibilidad y teclado sin dependencias. */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <p className="pb-4 leading-relaxed text-muted-foreground">{a}</p>
    </details>
  )
}

export default function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <span className="mm-mono inline-block rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Centro de ayuda
      </span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Preguntas Frecuentes
      </h1>
      <p className="mt-2 text-muted-foreground">
        Todo lo que necesitas saber sobre ModelMarket. ¿No encuentras lo que buscas?{' '}
        <Link to="/contacto" className="text-primary underline underline-offset-4">
          Contáctanos
        </Link>
        .
      </p>

      <div className="mt-10 space-y-10">
        {FAQ.map(({ group, items }) => (
          <div key={group}>
            <h2 className="mb-2 font-display text-lg font-extrabold">{group}</h2>
            <div className="rounded-lg border-2 border-border bg-card px-5">
              {items.map((item) => (
                <FaqItem key={item.q} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg border-2 border-dashed border-border p-8 text-center">
        <h2 className="font-display text-lg font-extrabold">¿Tienes más preguntas?</h2>
        <p className="mt-2 text-muted-foreground">
          Escríbenos a{' '}
          <a
            href="mailto:info@modelmarket.es"
            className="text-primary underline underline-offset-4"
          >
            info@modelmarket.es
          </a>
        </p>
      </div>
    </section>
  )
}
