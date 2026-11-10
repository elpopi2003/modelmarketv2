import { sql } from 'kysely'
import type { Db } from '../db/client'
import { generateToken, hashToken } from './tokens'

export const SESSION_COOKIE = 'mm_session'
/** La caducidad se renueva como mucho una vez por hora, no en cada petición. */
const TOUCH_EVERY_MS = 60 * 60 * 1000

export interface SessionMeta {
  ip?: string | null
  userAgent?: string | null
}

export async function createSession(
  db: Db,
  userId: string,
  ttlDays: number,
  meta: SessionMeta = {},
) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000)
  await db
    .insertInto('sessions')
    .values({
      id: hashToken(token),
      user_id: userId,
      expires_at: expiresAt,
      ip: meta.ip ?? null,
      user_agent: meta.userAgent?.slice(0, 255) ?? null,
    })
    .execute()
  return { token, expiresAt }
}

export interface SessionAuth {
  sessionId: string
  userId: string
  email: string
  emailVerified: boolean
  /** Rol admin, resuelto en la misma consulta que la sesión. */
  isAdmin: boolean
}

/**
 * Resuelve el token de la cookie. Devuelve null si no existe, ha caducado o el usuario
 * está suspendido (en ese caso borra la sesión: una suspensión echa al usuario aunque
 * tuviera la sesión abierta en otro dispositivo).
 *
 * Caducidad deslizante: mientras se use, la sesión no caduca.
 */
export async function resolveSession(
  db: Db,
  token: string,
  ttlDays: number,
): Promise<SessionAuth | null> {
  const id = hashToken(token)
  const row = await db
    .selectFrom('sessions as s')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .leftJoin('user_suspensions as us', 'us.user_id', 's.user_id')
    .select([
      's.id',
      's.user_id',
      's.expires_at',
      's.last_seen_at',
      'u.email',
      'u.email_verified_at',
      'us.user_id as suspended',
      sql<number>`EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = s.user_id AND r.role = 'admin')`.as(
        'is_admin',
      ),
    ])
    .where('s.id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (row.expires_at.getTime() <= Date.now() || row.suspended) {
    await db.deleteFrom('sessions').where('id', '=', id).execute()
    return null
  }
  if (Date.now() - row.last_seen_at.getTime() > TOUCH_EVERY_MS) {
    await db
      .updateTable('sessions')
      .set({
        last_seen_at: sql<Date>`NOW(3)`,
        expires_at: new Date(Date.now() + ttlDays * 86_400_000),
      })
      .where('id', '=', id)
      .execute()
  }
  return {
    sessionId: row.id,
    userId: row.user_id,
    email: row.email,
    emailVerified: row.email_verified_at !== null,
    isAdmin: Number(row.is_admin) === 1,
  }
}

export async function deleteSession(db: Db, token: string) {
  await db.deleteFrom('sessions').where('id', '=', hashToken(token)).execute()
}

/** Cierra todas las sesiones de un usuario, salvo opcionalmente la actual. */
export async function deleteUserSessions(db: Db, userId: string, exceptSessionId?: string) {
  let q = db.deleteFrom('sessions').where('user_id', '=', userId)
  if (exceptSessionId) q = q.where('id', '!=', exceptSessionId)
  await q.execute()
}

/** Limpieza periódica de sesiones caducadas (las que nadie volvió a usar). */
export async function purgeExpiredSessions(db: Db) {
  await db
    .deleteFrom('sessions')
    .where('expires_at', '<', sql<Date>`NOW(3)`)
    .execute()
}
