import { AppError } from '@/lib/errors'

/**
 * Cliente de la API propia (`/api`, servidor Node en el VPS).
 *
 * Todas las respuestas tienen la forma `{ ok, data, error }`. Si `ok` es false se lanza un
 * `AppError` con el mensaje del servidor (ya redactado para el usuario) y su `code`, para
 * que la interfaz pueda reaccionar a casos concretos (`email_not_confirmed`, ...).
 *
 * La sesión viaja en una cookie httpOnly del mismo origen: no hay tokens que guardar en
 * el navegador.
 */
type ApiEnvelope<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { code: string; message: string } }

const NETWORK_ERROR =
  'No hemos podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

export async function api<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const { method = options.body === undefined ? 'GET' : 'POST', body, signal } = options
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    throw new AppError(NETWORK_ERROR, { code: 'network', cause })
  }

  let payload: ApiEnvelope<T>
  try {
    payload = (await res.json()) as ApiEnvelope<T>
  } catch (cause) {
    throw new AppError(NETWORK_ERROR, { code: `http_${res.status}`, cause })
  }

  if (!payload.ok) throw new AppError(payload.error.message, { code: payload.error.code })
  return payload.data
}
