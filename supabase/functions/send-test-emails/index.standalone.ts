// ============================================================================
// send-test-emails — VERSIÓN AUTO-CONTENIDA (un solo fichero) para pegar en el
// editor web del dashboard de Supabase (Edge Functions → Deploy a new function).
//
// Envía un ejemplo de CADA notificación por email a un destinatario.
// Protegida por el secreto EMAIL_TEST_SECRET.
//
// Secretos necesarios (Edge Functions → Secrets): RESEND_API_KEY, EMAIL_FROM,
// EMAIL_TEST_SECRET, APP_URL.  Al desplegar, desactiva "Verify JWT".
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-test-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ ok: true, data, error: null }), { status, headers: jsonHeaders })
const fail = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, data: null, error }), { status, headers: jsonHeaders })

async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') ?? 'ModelMarket <onboarding@resend.dev>'
  if (!apiKey) throw new Error('Falta el secreto RESEND_API_KEY')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return await res.json()
}

const appUrl = () => Deno.env.get('APP_URL') ?? 'https://modelmarket.es'

function layout(o: {
  heading: string
  intro?: string
  paragraphs?: string[]
  cta?: { label: string; path: string }
  footNote?: string
}): string {
  const base = appUrl()
  const paras = (o.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${p}</p>`)
    .join('')
  const cta = o.cta
    ? `<div style="margin:22px 0 6px;"><a href="${base}${o.cta.path}" style="display:inline-block;background:#1B3A5F;color:#fff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;">${o.cta.label}</a></div>`
    : ''
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">
    <div style="background:#1B3A5F;padding:18px 24px;"><span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:0.5px;">Model<span style="color:#F7941D;">Market</span></span></div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;line-height:1.3;">${o.heading}</h1>
      ${o.intro ? `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${o.intro}</p>` : ''}
      ${paras}${cta}
      ${o.footNote ? `<p style="margin:18px 0 0;color:#5B6B7B;font-size:12px;line-height:1.5;">${o.footNote}</p>` : ''}
    </div>
    <div style="background:#F9FAFB;border-top:1px solid #E1E7EF;padding:14px 24px;color:#5B6B7B;font-size:12px;">ModelMarket — Nada de comisiones, sólo maquetas.</div>
  </div></body></html>`
}

function allSampleEmails(): { type: string; subject: string; html: string }[] {
  return [
    {
      type: 'welcome',
      subject: '¡Bienvenido a ModelMarket!',
      html: layout({
        heading: 'Bienvenido, Alfredo',
        intro:
          'Tu cuenta está lista. Publica anuncios, crea peticiones y contacta con otros coleccionistas — siempre con 0% de comisión.',
        cta: { label: 'Explorar el catálogo', path: '/explorar' },
      }),
    },
    {
      type: 'pro-welcome',
      subject: 'Ya eres PRO en ModelMarket',
      html: layout({
        heading: 'Gracias por hacerte PRO, Alfredo',
        intro:
          'Has desbloqueado anuncios ilimitados, más fotos, visibilidad inmediata e insignia PRO.',
        cta: { label: 'Publicar un anuncio', path: '/publicar' },
      }),
    },
    {
      type: 'downgrade',
      subject: 'Tu plan ha cambiado a Free',
      html: layout({
        heading: 'Tu suscripción ha vuelto a Free, Alfredo',
        intro: 'Seguirás teniendo acceso con los límites del plan Free. Puedes volver a PRO cuando quieras.',
        cta: { label: 'Ver planes', path: '/precios' },
      }),
    },
    {
      type: 'new-message',
      subject: 'Nuevo mensaje de Comprador de prueba',
      html: layout({
        heading: 'Tienes un nuevo mensaje',
        paragraphs: [
          '<strong>Comprador de prueba</strong> te ha escrito sobre <strong>Panzer IV Ausf. H 1:35</strong>.',
        ],
        cta: { label: 'Leer el mensaje', path: '/mensajes/00000000-0000-0000-0000-000000000000' },
      }),
    },
    {
      type: 'new-offer',
      subject: 'Oferta por "Panzer IV Ausf. H 1:35"',
      html: layout({
        heading: 'Has recibido una oferta',
        paragraphs: [
          'Alguien ofrece <strong>45,00 €</strong> por tu anuncio <strong>Panzer IV Ausf. H 1:35</strong>.',
        ],
        cta: { label: 'Ver el anuncio', path: '/producto/00000000-0000-0000-0000-000000000000' },
      }),
    },
    {
      type: 'new-request-offer',
      subject: 'Alguien tiene lo que buscas',
      html: layout({
        heading: 'Respuesta a tu petición',
        paragraphs: ['Un vendedor puede tener lo que pedías en <strong>Busco Airfix Spitfire 1:48</strong>.'],
        cta: { label: 'Ver peticiones', path: '/mis-peticiones' },
      }),
    },
    {
      type: 'listing-status',
      subject: 'Tu anuncio está publicado',
      html: layout({
        heading: 'Anuncio aprobado',
        paragraphs: ['Tu anuncio <strong>Panzer IV Ausf. H 1:35</strong> ya es visible en el catálogo.'],
        cta: { label: 'Ver el anuncio', path: '/producto/00000000-0000-0000-0000-000000000000' },
      }),
    },
    {
      type: 'request-status',
      subject: 'Tu petición: Encontrada',
      html: layout({
        heading: 'Estado de tu petición',
        paragraphs: [
          'Tu petición <strong>Busco Airfix Spitfire 1:48</strong> ha cambiado a <strong>Encontrada</strong>.',
        ],
        cta: { label: 'Ver tus peticiones', path: '/mis-peticiones' },
      }),
    },
    {
      type: 'contact',
      subject: 'Contacto de Visitante',
      html: layout({
        heading: 'Nuevo mensaje del formulario de contacto',
        paragraphs: [
          '<strong>De:</strong> Visitante (visitante@example.com)',
          '<strong>Mensaje:</strong><br>Hola, tengo una duda sobre los planes PRO.',
        ],
        footNote: 'Responde directamente a este email para contestar al remitente.',
      }),
    },
  ]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)
  try {
    const secret = Deno.env.get('EMAIL_TEST_SECRET')
    if (secret && req.headers.get('x-test-secret') !== secret) return fail('No autorizado', 401)

    const { to } = await req.json().catch(() => ({}))
    if (!to || typeof to !== 'string') return fail('Falta el campo "to" (email destino)')

    const samples = allSampleEmails()
    const results: { type: string; sent: boolean; id?: string; error?: string }[] = []
    for (const s of samples) {
      try {
        const { id } = await sendEmail(to, `[TEST] ${s.subject}`, s.html)
        results.push({ type: s.type, sent: true, id })
      } catch (e) {
        results.push({ type: s.type, sent: false, error: String(e) })
      }
    }
    return ok({ to, total: samples.length, sent: results.filter((r) => r.sent).length, results })
  } catch (e) {
    return fail(String(e), 500)
  }
})
