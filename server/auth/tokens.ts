import { createHash, randomBytes } from 'node:crypto'

/**
 * Token aleatorio de 256 bits para cookies de sesión y enlaces por email. Se entrega al
 * usuario tal cual; en la base de datos solo se guarda `hashToken(token)`.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 en hex (64 caracteres). Suficiente: el token ya tiene 256 bits de entropía. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
