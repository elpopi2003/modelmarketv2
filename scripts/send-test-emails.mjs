// Envía un email de prueba de CADA notificación de ModelMarket vía Resend.
// No necesita Supabase ni despliegue: llama a la API de Resend directamente.
//
// Uso (PowerShell):
//   $env:RESEND_API_KEY = "re_tu_clave"
//   node scripts/send-test-emails.mjs alf.mosquera@gmail.com
//
// Opcionales (env): EMAIL_FROM (por defecto onboarding@resend.dev), APP_URL.
// NO pongas la clave en el código: va por variable de entorno.

const API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM ?? 'ModelMarket <onboarding@resend.dev>'
const APP_URL = process.env.APP_URL ?? 'https://modelmarket.es'
const TO = process.argv[2] ?? 'alf.mosquera@gmail.com'

if (!API_KEY) {
  console.error('❌ Falta RESEND_API_KEY en el entorno. En PowerShell:  $env:RESEND_API_KEY = "re_..."')
  process.exit(1)
}

function layout({ heading, intro, paragraphs = [], cta, footNote }) {
  const paras = paragraphs
    .map((p) => `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${p}</p>`)
    .join('')
  const ctaHtml = cta
    ? `<div style="margin:22px 0 6px;"><a href="${APP_URL}${cta.path}" style="display:inline-block;background:#1B3A5F;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;">${cta.label}</a></div>`
    : ''
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">
    <div style="background:#1B3A5F;padding:18px 24px;"><span style="color:#fff;font-size:18px;font-weight:800;">Model<span style="color:#F7941D;">Market</span></span></div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;">${heading}</h1>
      ${intro ? `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${intro}</p>` : ''}
      ${paras}${ctaHtml}
      ${footNote ? `<p style="margin:18px 0 0;color:#5B6B7B;font-size:12px;">${footNote}</p>` : ''}
    </div>
    <div style="background:#F9FAFB;border-top:1px solid #E1E7EF;padding:14px 24px;color:#5B6B7B;font-size:12px;">ModelMarket — Nada de comisiones, sólo maquetas.</div>
  </div></body></html>`
}

const samples = [
  { type: 'welcome', subject: '¡Bienvenido a ModelMarket!', html: layout({ heading: 'Bienvenido, Alfredo', intro: 'Tu cuenta está lista. Publica anuncios, crea peticiones y contacta con otros coleccionistas — siempre con 0% de comisión.', cta: { label: 'Explorar el catálogo', path: '/explorar' } }) },
  { type: 'pro-welcome', subject: 'Ya eres PRO en ModelMarket', html: layout({ heading: 'Gracias por hacerte PRO, Alfredo', intro: 'Has desbloqueado anuncios ilimitados, más fotos, visibilidad inmediata e insignia PRO.', cta: { label: 'Publicar un anuncio', path: '/publicar' } }) },
  { type: 'downgrade', subject: 'Tu plan ha cambiado a Free', html: layout({ heading: 'Tu suscripción ha vuelto a Free, Alfredo', intro: 'Seguirás teniendo acceso con los límites del plan Free. Puedes volver a PRO cuando quieras.', cta: { label: 'Ver planes', path: '/precios' } }) },
  { type: 'new-message', subject: 'Nuevo mensaje de Comprador de prueba', html: layout({ heading: 'Tienes un nuevo mensaje', paragraphs: ['<strong>Comprador de prueba</strong> te ha escrito sobre <strong>Panzer IV Ausf. H 1:35</strong>.'], cta: { label: 'Leer el mensaje', path: '/mensajes/demo' } }) },
  { type: 'new-offer', subject: 'Oferta por "Panzer IV Ausf. H 1:35"', html: layout({ heading: 'Has recibido una oferta', paragraphs: ['Alguien ofrece <strong>45,00 €</strong> por tu anuncio <strong>Panzer IV Ausf. H 1:35</strong>.'], cta: { label: 'Ver el anuncio', path: '/producto/demo' } }) },
  { type: 'new-request-offer', subject: 'Alguien tiene lo que buscas', html: layout({ heading: 'Respuesta a tu petición', paragraphs: ['Un vendedor puede tener lo que pedías en <strong>Busco Airfix Spitfire 1:48</strong>.'], cta: { label: 'Ver peticiones', path: '/mis-peticiones' } }) },
  { type: 'listing-status', subject: 'Tu anuncio está publicado', html: layout({ heading: 'Anuncio aprobado', paragraphs: ['Tu anuncio <strong>Panzer IV Ausf. H 1:35</strong> ya es visible en el catálogo.'], cta: { label: 'Ver el anuncio', path: '/producto/demo' } }) },
  { type: 'request-status', subject: 'Tu petición: Encontrada', html: layout({ heading: 'Estado de tu petición', paragraphs: ['Tu petición <strong>Busco Airfix Spitfire 1:48</strong> ha cambiado a <strong>Encontrada</strong>.'], cta: { label: 'Ver tus peticiones', path: '/mis-peticiones' } }) },
  { type: 'contact', subject: 'Contacto de Visitante', html: layout({ heading: 'Nuevo mensaje del formulario de contacto', paragraphs: ['<strong>De:</strong> Visitante (visitante@example.com)', '<strong>Mensaje:</strong><br>Hola, tengo una duda sobre los planes PRO.'], footNote: 'Responde directamente a este email para contestar al remitente.' }) },
]

console.log(`Enviando ${samples.length} emails de prueba a ${TO} (from: ${FROM})…\n`)
let sent = 0
for (const s of samples) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: TO, subject: `[TEST] ${s.subject}`, html: s.html }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      sent++
      console.log(`✓ ${s.type.padEnd(18)} id=${data.id}`)
    } else {
      console.log(`✗ ${s.type.padEnd(18)} ${res.status} ${JSON.stringify(data)}`)
    }
  } catch (e) {
    console.log(`✗ ${s.type.padEnd(18)} ${e}`)
  }
}
console.log(`\nEnviados ${sent}/${samples.length} a ${TO}. Revisa la bandeja (y spam).`)
