import type { ZodType, ZodTypeDef } from 'zod'
import { badRequest } from './reply'

/**
 * Valida datos de entrada con Zod. Si fallan, responde 400 con el primer mensaje: los
 * mensajes de los schemas ya están redactados para mostrarse al usuario tal cual.
 */
export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data ?? {})
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? 'Datos no válidos')
  return result.data
}
