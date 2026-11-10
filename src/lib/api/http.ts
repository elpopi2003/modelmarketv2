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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const NETWORK_ERROR =
  'No hemos podido conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

async function request<T>(
  path: string,
  init: { method: Method; body?: BodyInit; headers?: HeadersInit; signal?: AbortSignal },
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, credentials: 'same-origin' })
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

/** Petición JSON. Con `body` y sin `method`, es un POST. */
export function api<T>(
  path: string,
  options: { method?: Method; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = options.body === undefined ? 'GET' : 'POST', body, signal } = options
  return request<T>(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * Sube un fichero (multipart, campo `file`). Sin Content-Type explícito: lo pone el
 * navegador con el boundary correcto.
 */
export function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  return request<T>(path, { method: 'POST', body: form })
}

/** Query string a partir de un objeto. Omite undefined, null y ''. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
