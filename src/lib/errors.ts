import type { PostgrestError } from '@supabase/supabase-js'

/** Error normalizado de la app, con mensaje ya apto para mostrar al usuario. */
export class AppError extends Error {
  readonly code?: string

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message)
    this.name = 'AppError'
    this.code = options?.code
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

const DEFAULT_MESSAGE = 'Algo salió mal. Inténtalo de nuevo.'

/** Traducción de códigos Postgres/PostgREST habituales a mensajes en español. */
const MESSAGES_BY_CODE: Record<string, string> = {
  '23505': 'Ya existe un registro con esos datos.',
  '23503': 'La operación hace referencia a datos que no existen.',
  '23502': 'Faltan campos obligatorios.',
  '42501': 'No tienes permisos para realizar esta acción.',
  PGRST301: 'No tienes permisos para acceder a estos datos.',
  PGRST116: 'No se encontró el recurso solicitado.',
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error &&
    'details' in error
  )
}

/** Extrae un mensaje legible para el usuario de cualquier error. */
export function getErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (error instanceof AppError) return error.message
  if (isPostgrestError(error)) {
    if (error.code && MESSAGES_BY_CODE[error.code]) return MESSAGES_BY_CODE[error.code]
    return error.message || fallback
  }
  if (error instanceof Error) return error.message || fallback
  return fallback
}

/**
 * Normaliza un error de Supabase/PostgREST y lo relanza como `AppError`.
 * Pensado para usarse en la capa `lib/api/*` (y su mensaje, para toasts en los hooks).
 */
export function handleSupabaseError(error: unknown, fallback?: string): never {
  const message = getErrorMessage(error, fallback)
  const code = isPostgrestError(error)
    ? error.code
    : error instanceof AppError
      ? error.code
      : undefined

  if (import.meta.env.DEV) {
    console.error('[supabase]', error)
  }

  throw new AppError(message, { code, cause: error })
}
