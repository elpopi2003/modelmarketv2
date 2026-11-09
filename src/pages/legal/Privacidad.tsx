import { Link } from 'react-router-dom'
import { LegalDoc, type LegalSection } from '@/components/layout/LegalDoc'

const SECTIONS: LegalSection[] = [
  {
    title: 'Responsable del tratamiento',
    paragraphs: [
      'El responsable del tratamiento de los datos personales recogidos a través de ModelMarket (en adelante, «la Plataforma») es ModelMarket. Puedes contactarnos a través de la sección de contacto de la Plataforma para cualquier consulta relacionada con la protección de tus datos personales.',
    ],
  },
  {
    title: 'Normativa aplicable',
    paragraphs: [
      'Esta Política de Privacidad se redacta conforme a las siguientes disposiciones legales:',
    ],
    list: [
      'Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo (RGPD).',
      'Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).',
      'Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE).',
    ],
  },
  {
    title: 'Datos personales que recopilamos',
    paragraphs: ['Recopilamos los siguientes datos personales:'],
    list: [
      'Datos de registro: dirección de correo electrónico, nombre de usuario y contraseña.',
      'Datos de perfil: nombre visible, avatar, ubicación y biografía (proporcionados voluntariamente).',
      'Datos de actividad: anuncios publicados, peticiones creadas, mensajes enviados y favoritos guardados.',
      'Datos técnicos: dirección IP, tipo de navegador, sistema operativo y datos de navegación recogidos mediante cookies.',
      'Datos de suscripción: información relacionada con el plan contratado (no almacenamos datos bancarios completos).',
    ],
  },
  {
    title: 'Finalidad del tratamiento',
    paragraphs: ['Tratamos tus datos personales con las siguientes finalidades:'],
    list: [
      'Gestionar tu registro y autenticación en la Plataforma.',
      'Permitir la publicación de anuncios, peticiones y la comunicación entre usuarios.',
      'Gestionar las suscripciones y los servicios asociados al plan PRO.',
      'Enviar notificaciones relacionadas con tu actividad (mensajes recibidos, estado de anuncios, etc.).',
      'Mejorar la Plataforma mediante el análisis de uso y rendimiento.',
      'Prevenir el fraude y garantizar la seguridad del servicio.',
      'Cumplir con las obligaciones legales aplicables.',
    ],
  },
  {
    title: 'Base jurídica del tratamiento',
    paragraphs: ['El tratamiento de tus datos se fundamenta en:'],
    list: [
      'Ejecución del contrato: el registro y uso de la Plataforma requieren el tratamiento de determinados datos (art. 6.1.b RGPD).',
      'Consentimiento: para el envío de comunicaciones comerciales y el uso de cookies no esenciales (art. 6.1.a RGPD).',
      'Interés legítimo: para la mejora del servicio, la prevención del fraude y la seguridad de la Plataforma (art. 6.1.f RGPD).',
      'Obligación legal: para el cumplimiento de normativas fiscales, mercantiles o de otra índole (art. 6.1.c RGPD).',
    ],
  },
  {
    title: 'Conservación de los datos',
    paragraphs: [
      'Los datos personales se conservarán mientras se mantenga la relación contractual y, una vez finalizada, durante los plazos de prescripción legal aplicables. En concreto:',
    ],
    list: [
      'Datos de la cuenta: mientras la cuenta esté activa y hasta 5 años después de su eliminación.',
      'Datos de transacciones: 6 años conforme a la legislación mercantil.',
      'Datos de navegación: máximo 2 años.',
    ],
  },
  {
    title: 'Cesión de datos a terceros',
    paragraphs: [
      'No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Solo compartimos datos en los siguientes supuestos:',
    ],
    list: [
      'Proveedores de servicios: empresas que nos prestan servicios técnicos esenciales (alojamiento, correo electrónico, pasarelas de pago), actuando como encargados del tratamiento bajo contrato.',
      'Obligación legal: cuando sea requerido por autoridades judiciales o administrativas.',
      'Otros usuarios: la información de tu perfil público (nombre visible, avatar, ubicación) es accesible para otros usuarios de la Plataforma.',
    ],
  },
  {
    title: 'Transferencias internacionales',
    paragraphs: [
      'Algunos de nuestros proveedores de servicios pueden estar ubicados fuera del Espacio Económico Europeo (EEE). En tales casos, garantizamos que las transferencias se realizan con las salvaguardas adecuadas, incluyendo cláusulas contractuales tipo aprobadas por la Comisión Europea o decisiones de adecuación vigentes.',
    ],
  },
  {
    title: 'Derechos del usuario',
    paragraphs: [
      'De conformidad con el RGPD y la LOPDGDD, puedes ejercer los siguientes derechos:',
    ],
    list: [
      'Acceso: conocer qué datos personales tuyos tratamos.',
      'Rectificación: corregir datos inexactos o incompletos.',
      'Supresión: solicitar la eliminación de tus datos cuando ya no sean necesarios.',
      'Oposición: oponerte al tratamiento de tus datos en determinadas circunstancias.',
      'Limitación: solicitar la limitación del tratamiento de tus datos.',
      'Portabilidad: recibir tus datos en un formato estructurado y de uso común.',
      'No ser objeto de decisiones automatizadas: incluida la elaboración de perfiles con efectos jurídicos.',
    ],
    after: [
      'Para ejercer estos derechos, contacta con nosotros a través de la sección de contacto. Responderemos en un plazo máximo de 30 días. Si consideras que tus derechos no han sido debidamente atendidos, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en www.aepd.es.',
    ],
  },
  {
    title: 'Seguridad de los datos',
    paragraphs: [
      'Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos personales contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Entre otras medidas, utilizamos cifrado SSL/TLS, autenticación segura, control de accesos y copias de seguridad periódicas.',
    ],
  },
  {
    title: 'Menores de edad',
    paragraphs: [
      'La Plataforma no está dirigida a menores de 18 años. No recopilamos conscientemente datos personales de menores. Si detectamos que un menor se ha registrado, procederemos a la eliminación inmediata de su cuenta y datos asociados, conforme al artículo 7 de la LOPDGDD.',
    ],
  },
  {
    title: 'Modificaciones',
    paragraphs: [
      'Nos reservamos el derecho de actualizar esta Política de Privacidad. Cualquier modificación será publicada en esta página con la fecha de última actualización. Te recomendamos revisar periódicamente esta política.',
    ],
  },
]

export default function Privacidad() {
  return (
    <LegalDoc
      title="Política de Privacidad"
      lastUpdated="1 de marzo de 2026"
      sections={SECTIONS}
      footer={
        <>
          Para más información sobre el uso de cookies, consulta nuestra{' '}
          <Link to="/cookies" className="text-primary underline underline-offset-4">
            Política de Cookies
          </Link>
          .
        </>
      }
    />
  )
}
