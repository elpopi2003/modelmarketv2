/**
 * Formato homogéneo de respuesta de la API: `{ ok, data, error }` (CLAUDE.md §5.5).
 * El frontend solo tiene que mirar `ok` y, si es false, mostrar `error.message`.
 */
export type ApiError = { code: string; message: string }
export type ApiResponse<T> = { ok: true; data: T; error: null } | { ok: false; data: null; error: ApiError }

export const ok = <T>(data: T): ApiResponse<T> => ({ ok: true, data, error: null })

export const fail = (code: string, message: string): ApiResponse<never> => ({
  ok: false,
  data: null,
  error: { code, message },
})

/**
 * Error de negocio con código HTTP. Se lanza desde rutas y servicios; el manejador
 * global lo convierte en `fail(...)` con el status indicado.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, code, message)
export const unauthorized = (message = 'Necesitas iniciar sesión.') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'No tienes permiso para hacer esto.') => new HttpError(403, 'forbidden', message)
export const notFound = (message = 'No encontrado.') => new HttpError(404, 'not_found', message)
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message)
