import argon2 from 'argon2'
import bcrypt from 'bcryptjs'

/**
 * Contraseñas:
 *  - Nuevas: argon2id (recomendación OWASP), con los parámetros por defecto de la librería
 *    (64 MiB, 3 iteraciones).
 *  - Migradas de Supabase: bcrypt ($2a$/$2b$/$2y$). Se aceptan y se marcan para recifrar
 *    con argon2id en el primer login correcto, sin que la persona note nada.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export type VerifyResult = { valid: boolean; needsRehash: boolean }

const isBcrypt = (hash: string) => /^\$2[aby]\$/.test(hash)

export async function verifyPassword(hash: string | null, password: string): Promise<VerifyResult> {
  if (!hash) {
    // Sin contraseña guardada: se gasta el mismo tiempo que en una comprobación real para
    // que la respuesta no delate qué cuentas existen.
    await burnTime(password)
    return { valid: false, needsRehash: false }
  }
  if (isBcrypt(hash)) {
    const valid = await bcrypt.compare(password, hash)
    return { valid, needsRehash: valid }
  }
  try {
    const valid = await argon2.verify(hash, password)
    return { valid, needsRehash: valid && argon2.needsRehash(hash) }
  } catch {
    return { valid: false, needsRehash: false }
  }
}

let dummyHash: Promise<string> | null = null
/** Comprobación contra un hash ficticio: iguala el tiempo de respuesta de "no existe". */
export async function burnTime(password: string): Promise<void> {
  dummyHash ??= hashPassword('modelmarket-dummy-password')
  await argon2.verify(await dummyHash, password).catch(() => false)
}
