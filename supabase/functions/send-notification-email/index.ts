// send-notification-email — despachador de avisos por email.
//
// Lo invoca un Database Webhook de Supabase en cada INSERT sobre `public.notifications`.
// Los triggers de la BD ya redactan título/cuerpo/enlace por cada evento (mensaje,
// oferta, favorito, reporte, bienvenida…), así que un único despachador cubre todos los
// tipos actuales y los que se añadan después, y aplica la preferencia `notify_email`
// en un solo sitio.
//
// Nunca falla "hacia arriba": si el usuario tiene los emails desactivados, no existe, o
// Resend da error, responde 200 con el motivo. Un webhook reintentando en bucle por un
// email es peor que perder un aviso.
//
// Autocontenida a propósito (misma convención que check-subscription): las funciones
// desplegadas de este proyecto no importan de _shared.
//
// Secretos: RESEND_API_KEY, EMAIL_FROM, APP_URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data, error: null }), { headers: jsonHeaders })
const fail = (error: string, status = 400) =>
  new Response(JSON.stringify({ ok: false, data: null, error }), { status, headers: jsonHeaders })

function appUrl(): string {
  const raw = Deno.env.get('APP_URL') ?? 'https://modelmarket.es'
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
}

/** Maquetación "Blueprint" con CSS inline (compatible con clientes de correo). */
function layout(p: { heading: string; body?: string | null; link?: string | null }): string {
  const base = appUrl()
  const paragraph = p.body
    ? `<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">${p.body}</p>`
    : ''
  const cta = p.link
    ? `<div style="margin:22px 0 6px;"><a href="${base}${p.link}" style="display:inline-block;background:#1B3A5F;color:#ffffff;text-decoration:none;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:14px;">Abrir en ModelMarket</a></div>`
    : ''

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">
      <div style="background:#ffffff;padding:20px 24px 16px;border-bottom:3px solid #F7941D;">
        <img src="https://shanozqxmmdiqvqhffbz.supabase.co/storage/v1/object/public/brand/logo.png" alt="ModelMarket" width="220"
             style="display:block;border:0;outline:none;text-decoration:none;width:220px;max-width:100%;height:auto;" />
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;line-height:1.3;">${p.heading}</h1>
        ${paragraph}
        ${cta}
        <p style="margin:18px 0 0;color:#5B6B7B;font-size:12px;line-height:1.5;">Puedes desactivar estos avisos en Configuración → Notificaciones.</p>
      </div>
      <div style="background:#F9FAFB;border-top:1px solid #E1E7EF;padding:14px 24px;color:#5B6B7B;font-size:12px;">
        ModelMarket — Nada de comisiones, sólo maquetas.
      </div>
    </div>
  </body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') ?? 'ModelMarket <onboarding@resend.dev>'
  if (!apiKey) throw new Error('Falta el secreto RESEND_API_KEY')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.id
}

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
}

/**
 * Rol del llamante, leído del JWT ya validado por la plataforma (verify_jwt).
 * Solo se decodifica el payload: la firma la comprobó el gateway antes de llegar aquí.
 *
 * Imprescindible: sin esto, cualquiera con la clave publishable podría invocar la
 * función con un user_id y un título arbitrarios y mandar emails a cualquier usuario.
 */
function callerRole(req: Request): string | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Método no permitido', 405)

  // Solo el webhook (service_role). Un usuario autenticado NO puede disparar emails.
  if (callerRole(req) !== 'service_role') return fail('No autorizado', 403)

  try {
    const payload = await req.json().catch(() => null)
    // Acepta el formato de Database Webhook ({ record }) y una llamada directa.
    const row: NotificationRow | null = payload?.record ?? payload ?? null
    if (!row?.user_id || !row?.title) return fail('Payload sin notificación válida')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Preferencia del destinatario.
    const { data: profile } = await admin
      .from('profiles')
      .select('notify_email, display_name, username')
      .eq('id', row.user_id)
      .maybeSingle()

    if (profile && profile.notify_email === false) {
      return ok({ skipped: 'El usuario tiene desactivados los avisos por email' })
    }

    // El email vive en auth.users, no en profiles.
    const { data: userRes, error: userError } = await admin.auth.admin.getUserById(row.user_id)
    const to = userRes?.user?.email
    if (userError || !to) {
      return ok({ skipped: 'Destinatario sin email' })
    }

    const id = await sendEmail(to, row.title, layout({
      heading: row.title,
      body: row.body,
      link: row.link,
    }))

    return ok({ sent: id, to })
  } catch (e) {
    // No propagamos el error: evitamos que el webhook reintente en bucle.
    console.error('[send-notification-email]', e)
    return ok({ skipped: String(e) })
  }
})
