import { corsHeaders } from './cors.ts'

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

/** Respuesta homogénea de éxito: { ok: true, data, error: null }. */
export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, error: null }), {
    status,
    headers: jsonHeaders,
  })
}

/** Respuesta homogénea de error: { ok: false, data: null, error }. */
export function fail(error: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, data: null, error }), {
    status,
    headers: jsonHeaders,
  })
}
