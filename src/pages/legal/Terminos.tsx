import { Link } from 'react-router-dom'
import { LegalDoc, type LegalSection } from '@/components/layout/LegalDoc'

const SECTIONS: LegalSection[] = [
  {
    title: 'Aceptación de los términos',
    paragraphs: [
      'Al acceder y utilizar ModelMarket (en adelante, «la Plataforma»), aceptas cumplir con estos Términos de Uso. Si no estás de acuerdo con alguno de ellos, te rogamos que no utilices nuestros servicios. El uso continuado de la Plataforma constituye la aceptación de cualquier modificación futura de estos términos.',
    ],
  },
  {
    title: 'Descripción del servicio',
    paragraphs: [
      'ModelMarket es un marketplace especializado que conecta a coleccionistas y aficionados al modelismo estático (maquetas a escala). La Plataforma permite publicar anuncios de venta, crear peticiones de búsqueda y comunicarse entre usuarios. ModelMarket actúa exclusivamente como intermediario tecnológico y no participa en las transacciones entre usuarios.',
    ],
  },
  {
    title: 'Registro y cuentas de usuario',
    list: [
      'Debes ser mayor de 18 años para registrarte en la Plataforma.',
      'La información proporcionada durante el registro debe ser veraz y actualizada.',
      'Eres responsable de mantener la confidencialidad de tus credenciales de acceso.',
      'Cada persona solo puede mantener una cuenta activa.',
      'Nos reservamos el derecho de suspender o eliminar cuentas que infrinjan estos términos.',
    ],
  },
  {
    title: 'Publicación de anuncios',
    list: [
      'Solo se permite publicar artículos relacionados con el modelismo estático: maquetas, herramientas, pinturas, accesorios y materiales afines.',
      'Las descripciones deben ser precisas y reflejar fielmente el estado del producto (precintado, abierto o empezado).',
      'Las imágenes deben ser del producto real que se ofrece. Queda prohibido utilizar imágenes genéricas o de terceros.',
      'Los precios deben indicarse en euros (€) e incluir impuestos aplicables.',
      'Está prohibido publicar artículos falsificados, robados o cuya venta esté restringida por ley.',
      'La Plataforma se reserva el derecho de suspender o eliminar anuncios que no cumplan estas normas.',
    ],
  },
  {
    title: 'Transacciones entre usuarios',
    paragraphs: [
      'ModelMarket facilita el contacto entre compradores y vendedores, pero no interviene en las transacciones económicas. Por tanto:',
    ],
    list: [
      'La Plataforma no cobra comisiones sobre las ventas realizadas.',
      'Los acuerdos de precio, método de pago y envío son responsabilidad exclusiva de las partes implicadas.',
      'ModelMarket no se responsabiliza de incumplimientos, disputas o fraudes entre usuarios.',
      'Recomendamos utilizar métodos de pago con protección al comprador y conservar comprobantes de las transacciones.',
    ],
  },
  {
    title: 'Planes y suscripciones',
    list: [
      'La Plataforma ofrece un plan gratuito con funcionalidades limitadas y un plan PRO con ventajas adicionales.',
      'Los precios y condiciones del plan PRO están detallados en la sección de Precios.',
      'Las suscripciones se renuevan automáticamente salvo cancelación expresa por parte del usuario.',
      'No se realizan reembolsos por periodos parciales de suscripción ya consumidos.',
    ],
  },
  {
    title: 'Conducta del usuario',
    paragraphs: ['Queda expresamente prohibido:'],
    list: [
      'Utilizar la Plataforma para fines ilegales o no autorizados.',
      'Acosar, amenazar o difamar a otros usuarios.',
      'Publicar contenido ofensivo, discriminatorio o inapropiado.',
      'Manipular precios, crear anuncios falsos o engañosos.',
      'Intentar acceder sin autorización a cuentas de otros usuarios o sistemas de la Plataforma.',
      'Utilizar bots, scrapers o herramientas automatizadas sin autorización expresa.',
    ],
  },
  {
    title: 'Propiedad intelectual',
    paragraphs: [
      'Todo el contenido de la Plataforma (diseño, logotipos, textos, código fuente) es propiedad de ModelMarket o sus licenciantes y está protegido por las leyes de propiedad intelectual. Los usuarios conservan los derechos sobre el contenido que publican, pero otorgan a ModelMarket una licencia no exclusiva para mostrar dicho contenido dentro de la Plataforma.',
    ],
  },
  {
    title: 'Sistema de reportes',
    paragraphs: [
      'Los usuarios pueden reportar anuncios o comportamientos que infrinjan estos términos. El equipo de moderación revisará cada reporte y tomará las medidas oportunas, que pueden incluir la eliminación de contenido, la suspensión temporal o la eliminación definitiva de la cuenta infractora.',
    ],
  },
  {
    title: 'Limitación de responsabilidad',
    list: [
      'La Plataforma se ofrece «tal cual» y «según disponibilidad».',
      'ModelMarket no garantiza la disponibilidad ininterrumpida del servicio.',
      'No nos responsabilizamos de daños directos, indirectos o consecuentes derivados del uso de la Plataforma.',
      'No somos responsables de la calidad, seguridad o legalidad de los artículos publicados por los usuarios.',
    ],
  },
  {
    title: 'Protección de datos',
    paragraphs: [
      'El tratamiento de datos personales se rige por nuestra Política de Privacidad. Recopilamos únicamente los datos necesarios para el funcionamiento del servicio y no compartimos información personal con terceros salvo obligación legal. Los usuarios pueden ejercer sus derechos de acceso, rectificación, cancelación y oposición contactándonos a través de los canales habilitados.',
    ],
  },
  {
    title: 'Modificaciones de los términos',
    paragraphs: [
      'ModelMarket se reserva el derecho de modificar estos Términos de Uso en cualquier momento. Las modificaciones se publicarán en esta página con la fecha de actualización correspondiente. El uso continuado de la Plataforma tras la publicación de cambios implica la aceptación de los nuevos términos.',
    ],
  },
  {
    title: 'Legislación aplicable',
    paragraphs: [
      'Estos Términos de Uso se rigen por la legislación española. Cualquier controversia derivada de su interpretación o aplicación se someterá a la jurisdicción de los tribunales competentes en España.',
    ],
  },
]

export default function Terminos() {
  return (
    <LegalDoc
      title="Términos de Uso"
      lastUpdated="1 de marzo de 2026"
      sections={SECTIONS}
      footer={
        <>
          Si tienes alguna duda sobre estos Términos de Uso, no dudes en contactarnos a través de la{' '}
          <Link to="/contacto" className="text-primary underline underline-offset-4">
            sección de contacto
          </Link>{' '}
          de la Plataforma.
        </>
      }
    />
  )
}
