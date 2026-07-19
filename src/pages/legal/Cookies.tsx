import { Link } from 'react-router-dom'
import { LegalDoc, type LegalSection } from '@/components/layout/LegalDoc'

/** Tabla de cookies. Con scroll propio para no romper el ancho en móvil. */
function CookieTable({ rows }: { rows: { cookie: string; purpose: string; duration: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-border">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wide">
              Cookie
            </th>
            <th className="px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wide">
              Finalidad
            </th>
            <th className="px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wide">
              Duración
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.cookie}>
              <td className="mm-mono px-4 py-2 text-xs">{row.cookie}</td>
              <td className="px-4 py-2 text-muted-foreground">{row.purpose}</td>
              <td className="px-4 py-2 text-muted-foreground">{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SECTIONS: LegalSection[] = [
  {
    title: '¿Qué son las cookies?',
    paragraphs: [
      'Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo (ordenador, tablet o móvil) cuando visitas un sitio web. Permiten que el sitio recuerde tus acciones y preferencias durante un periodo de tiempo, de modo que no tengas que volver a configurarlos cada vez que vuelvas al sitio o navegues entre sus páginas.',
    ],
  },
  {
    title: 'Normativa aplicable',
    paragraphs: ['Esta Política de Cookies cumple con las siguientes disposiciones:'],
    list: [
      'Artículo 22.2 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE).',
      'Guía sobre el uso de las cookies de la Agencia Española de Protección de Datos (AEPD), actualizada en 2023.',
      'Reglamento (UE) 2016/679 (RGPD) en lo relativo al consentimiento para el tratamiento de datos personales.',
    ],
  },
  {
    title: 'Tipos de cookies que utilizamos',
    extra: (
      <div className="space-y-8">
        <div>
          <h3 className="mb-2 font-semibold text-foreground">
            Cookies técnicas (estrictamente necesarias)
          </h3>
          <p className="mb-3 leading-relaxed text-muted-foreground">
            Son imprescindibles para el funcionamiento de la Plataforma. Permiten la navegación, la
            autenticación de usuarios y la gestión de sesiones. No requieren consentimiento previo
            conforme al artículo 22.2 de la LSSI-CE.
          </p>
          <CookieTable
            rows={[
              {
                cookie: 'sb-access-token',
                purpose: 'Autenticación y sesión del usuario',
                duration: 'Sesión',
              },
              {
                cookie: 'sb-refresh-token',
                purpose: 'Renovación automática de la sesión',
                duration: '7 días',
              },
            ]}
          />
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-foreground">Cookies de preferencias</h3>
          <p className="mb-3 leading-relaxed text-muted-foreground">
            Almacenan las preferencias del usuario, como el tema visual (claro/oscuro) y
            configuraciones de interfaz. Mejoran la experiencia de uso sin ser estrictamente
            necesarias.
          </p>
          <CookieTable
            rows={[{ cookie: 'theme', purpose: 'Preferencia de tema visual', duration: '1 año' }]}
          />
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-foreground">Cookies de seguridad</h3>
          <p className="mb-3 leading-relaxed text-muted-foreground">
            Utilizadas para la protección contra spam y abuso mediante el servicio reCAPTCHA. Estas
            cookies son necesarias para garantizar la seguridad de la Plataforma.
          </p>
          <CookieTable
            rows={[
              {
                cookie: '_GRECAPTCHA',
                purpose: 'Protección contra bots y spam',
                duration: '6 meses',
              },
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Base jurídica',
    list: [
      'Cookies técnicas: exentas de consentimiento al ser estrictamente necesarias para la prestación del servicio (art. 22.2 LSSI-CE).',
      'Cookies de preferencias y seguridad: basadas en el interés legítimo del responsable para mejorar la experiencia y garantizar la seguridad (art. 6.1.f RGPD).',
      'Cookies analíticas o de terceros (si se implementan en el futuro): requerirán consentimiento previo e informado del usuario (art. 6.1.a RGPD).',
    ],
  },
  {
    title: 'Gestión y desactivación de cookies',
    paragraphs: [
      'Puedes configurar tu navegador para aceptar, rechazar o eliminar cookies. A continuación, te indicamos cómo hacerlo en los navegadores más habituales:',
    ],
    list: [
      'Google Chrome: Configuración → Privacidad y seguridad → Cookies y otros datos de sitios.',
      'Mozilla Firefox: Configuración → Privacidad y seguridad → Cookies y datos del sitio.',
      'Safari: Preferencias → Privacidad → Gestionar datos de sitios web.',
      'Microsoft Edge: Configuración → Cookies y permisos del sitio → Cookies y datos almacenados.',
    ],
    after: [
      'Ten en cuenta que la desactivación de cookies técnicas puede impedir el correcto funcionamiento de la Plataforma, incluyendo la imposibilidad de iniciar sesión.',
    ],
  },
  {
    title: 'Cookies de terceros',
    paragraphs: [
      'Actualmente, la Plataforma no utiliza cookies analíticas ni publicitarias de terceros. En caso de incorporarlas en el futuro, se actualizará esta política y se solicitará el consentimiento previo del usuario mediante un banner o panel de configuración de cookies conforme a la normativa vigente.',
    ],
  },
  {
    title: 'Actualizaciones',
    paragraphs: [
      'Esta Política de Cookies puede ser actualizada periódicamente para reflejar cambios en las cookies utilizadas o en la normativa aplicable. Te recomendamos consultar esta página regularmente.',
    ],
  },
]

export default function Cookies() {
  return (
    <LegalDoc
      title="Política de Cookies"
      lastUpdated="1 de marzo de 2026"
      sections={SECTIONS}
      footer={
        <>
          Para más información sobre cómo tratamos tus datos personales, consulta nuestra{' '}
          <Link to="/privacidad" className="text-primary underline underline-offset-4">
            Política de Privacidad
          </Link>
          .
        </>
      }
    />
  )
}
