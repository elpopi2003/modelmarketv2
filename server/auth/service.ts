import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Config } from '../config'
import type { Db } from '../db/client'
import type { AuthTokenPurpose } from '../db/schema'
import { enqueueEmail } from '../email/outbox'
import type { LayoutContext } from '../email/layout'
import {
  alreadyRegisteredEmail,
  passwordChangedEmail,
  resetPasswordEmail,
  verifyEmailEmail,
} from '../email/templates/auth'
import { HttpError, badRequest } from '../http/reply'
import { hashPassword, verifyPassword } from './password'
import { createSession, deleteUserSessions, type SessionMeta } from './sessions'
import { generateToken, hashToken } from './tokens'

const VERIFY_TTL_H = 24
const RESET_TTL_H = 1

export interface AuthDeps {
  db: Db
  config: Pick<Config, 'APP_URL' | 'MAIL_LOGO_URL' | 'SESSION_TTL_DAYS'>
}

const mailCtx = (c: AuthDeps['config']): LayoutContext => ({
  appUrl: c.APP_URL,
  logoUrl: c.MAIL_LOGO_URL,
})

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** Nombre para saludar en los emails: el visible del perfil o la parte local del email. */
async function greetingName(db: Db, userId: string, email: string) {
  const p = await db
    .selectFrom('profiles')
    .select('display_name')
    .where('id', '=', userId)
    .executeTakeFirst()
  return p?.display_name || email.split('@')[0]
}

/** Crea un enlace de un solo uso e invalida los anteriores del mismo tipo. */
async function issueToken(db: Db, userId: string, purpose: AuthTokenPurpose, ttlHours: number) {
  await db
    .updateTable('auth_tokens')
    .set({ used_at: sql<Date>`NOW(3)` })
    .where('user_id', '=', userId)
    .where('purpose', '=', purpose)
    .where('used_at', 'is', null)
    .execute()
  const token = generateToken()
  await db
    .insertInto('auth_tokens')
    .values({
      token_hash: hashToken(token),
      user_id: userId,
      purpose,
      expires_at: new Date(Date.now() + ttlHours * 3_600_000),
      used_at: null,
    })
    .execute()
  return token
}

/** Consume un enlace: válido solo si existe, es de ese tipo, no se ha usado y no caducó. */
async function consumeToken(db: Db, token: string, purpose: AuthTokenPurpose) {
  const tokenHash = hashToken(token)
  const row = await db
    .selectFrom('auth_tokens')
    .select(['user_id', 'expires_at', 'used_at'])
    .where('token_hash', '=', tokenHash)
    .where('purpose', '=', purpose)
    .forUpdate()
    .executeTakeFirst()
  if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) {
    throw new HttpError(
      400,
      'invalid_token',
      'El enlace no es válido o ha caducado. Pide uno nuevo.',
    )
  }
  await db
    .updateTable('auth_tokens')
    .set({ used_at: sql<Date>`NOW(3)` })
    .where('token_hash', '=', tokenHash)
    .execute()
  return row.user_id
}

async function sendVerification(deps: AuthDeps, db: Db, userId: string, email: string) {
  const token = await issueToken(db, userId, 'verify_email', VERIFY_TTL_H)
  const link = `${deps.config.APP_URL}/auth/verificar?token=${token}`
  await enqueueEmail(db, {
    to: email,
    kind: 'verify_email',
    content: verifyEmailEmail(await greetingName(db, userId, email), link, mailCtx(deps.config)),
  })
}

/**
 * Alta. Responde siempre lo mismo ("revisa tu email"), exista o no la cuenta, para no
 * revelar qué emails están registrados:
 *  - Email nuevo → crea usuario, perfil y rol 'user', y envía el enlace de verificación.
 *  - Ya verificado → avisa a su dueño de que ya tiene cuenta (no cambia nada).
 *  - Registrado sin verificar → la última alta manda: guarda su contraseña e invalida los
 *    enlaces anteriores. Verificar NO inicia sesión, así que si el enlace activara una
 *    contraseña ajena, su dueño no podría entrar y la restablecería (cerrando sesiones).
 */
export async function register(deps: AuthDeps, input: { email: string; password: string }) {
  const email = normalizeEmail(input.email)
  const passwordHash = await hashPassword(input.password)

  await deps.db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('users')
      .select(['id', 'email_verified_at'])
      .where('email', '=', email)
      .forUpdate()
      .executeTakeFirst()

    if (existing?.email_verified_at) {
      await enqueueEmail(trx, {
        to: email,
        kind: 'already_registered',
        content: alreadyRegisteredEmail(
          await greetingName(trx, existing.id, email),
          mailCtx(deps.config),
        ),
      })
      return
    }

    if (existing) {
      await trx
        .updateTable('users')
        .set({ password_hash: passwordHash })
        .where('id', '=', existing.id)
        .execute()
      await sendVerification(deps, trx, existing.id, email)
      return
    }

    const id = randomUUID()
    await trx
      .insertInto('users')
      .values({
        id,
        email,
        password_hash: passwordHash,
        email_verified_at: null,
        last_login_at: null,
      })
      .execute()
    await trx
      .insertInto('profiles')
      .values({
        id,
        username: null,
        display_name: email.split('@')[0],
        avatar_url: null,
        bio: null,
        location: null,
      })
      .execute()
    await trx
      .insertInto('user_roles')
      .values({ id: randomUUID(), user_id: id, role: 'user' })
      .execute()
    await sendVerification(deps, trx, id, email)
  })

  return { needsConfirmation: true as const }
}

export async function verifyEmail(deps: AuthDeps, token: string) {
  await deps.db.transaction().execute(async (trx) => {
    const userId = await consumeToken(trx, token, 'verify_email')
    await trx
      .updateTable('users')
      .set({ email_verified_at: sql<Date>`COALESCE(email_verified_at, NOW(3))` })
      .where('id', '=', userId)
      .execute()
  })
}

/** Reenvía el enlace de verificación. Silencioso si no hay cuenta pendiente con ese email. */
export async function resendVerification(deps: AuthDeps, rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  await deps.db.transaction().execute(async (trx) => {
    const u = await trx
      .selectFrom('users')
      .select(['id', 'email_verified_at'])
      .where('email', '=', email)
      .executeTakeFirst()
    if (u && !u.email_verified_at) await sendVerification(deps, trx, u.id, email)
  })
}

const INVALID_CREDENTIALS = () =>
  new HttpError(401, 'invalid_credentials', 'Email o contraseña incorrectos.')

export async function login(
  deps: AuthDeps,
  input: { email: string; password: string },
  meta: SessionMeta,
) {
  const email = normalizeEmail(input.email)
  const user = await deps.db
    .selectFrom('users as u')
    .leftJoin('user_suspensions as us', 'us.user_id', 'u.id')
    .select(['u.id', 'u.password_hash', 'u.email_verified_at', 'us.user_id as suspended'])
    .where('u.email', '=', email)
    .executeTakeFirst()

  const { valid, needsRehash } = await verifyPassword(user?.password_hash ?? null, input.password)
  if (!user || !valid) throw INVALID_CREDENTIALS()

  // Solo se revelan estos estados a quien ya ha demostrado conocer la contraseña.
  if (user.suspended) {
    throw new HttpError(
      403,
      'suspended',
      'Tu cuenta está suspendida. Revisa tu email para conocer el motivo.',
    )
  }
  if (!user.email_verified_at) {
    throw new HttpError(
      403,
      'email_not_confirmed',
      'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.',
    )
  }

  await deps.db
    .updateTable('users')
    .set({
      last_login_at: sql<Date>`NOW(3)`,
      ...(needsRehash ? { password_hash: await hashPassword(input.password) } : {}),
    })
    .where('id', '=', user.id)
    .execute()

  const session = await createSession(deps.db, user.id, deps.config.SESSION_TTL_DAYS, meta)
  return { ...session, userId: user.id }
}

/** Pide el enlace de recuperación. Silencioso si el email no tiene cuenta. */
export async function requestPasswordReset(deps: AuthDeps, rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  await deps.db.transaction().execute(async (trx) => {
    const u = await trx
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst()
    if (!u) return
    const token = await issueToken(trx, u.id, 'reset_password', RESET_TTL_H)
    await enqueueEmail(trx, {
      to: email,
      kind: 'reset_password',
      content: resetPasswordEmail(
        await greetingName(trx, u.id, email),
        `${deps.config.APP_URL}/auth/restablecer?token=${token}`,
        mailCtx(deps.config),
      ),
    })
  })
}

/**
 * Nueva contraseña desde el enlace del email. Cierra todas las sesiones, marca el email
 * como verificado (quien abre el enlace ha demostrado que el buzón es suyo) e inicia
 * sesión, salvo si la cuenta está suspendida.
 */
export async function resetPassword(
  deps: AuthDeps,
  token: string,
  password: string,
  meta: SessionMeta,
) {
  const passwordHash = await hashPassword(password)
  const userId = await deps.db.transaction().execute(async (trx) => {
    const id = await consumeToken(trx, token, 'reset_password')
    await trx
      .updateTable('users')
      .set({
        password_hash: passwordHash,
        email_verified_at: sql<Date>`COALESCE(email_verified_at, NOW(3))`,
      })
      .where('id', '=', id)
      .execute()
    await deleteUserSessions(trx, id)
    return id
  })
  const suspended = await deps.db
    .selectFrom('user_suspensions')
    .select('user_id')
    .where('user_id', '=', userId)
    .executeTakeFirst()
  if (suspended) return null
  return createSession(deps.db, userId, deps.config.SESSION_TTL_DAYS, meta)
}

/** Cambio de contraseña con sesión iniciada: cierra las demás sesiones y avisa por email. */
export async function changePassword(
  deps: AuthDeps,
  auth: { userId: string; sessionId: string; email: string },
  password: string,
) {
  if (password.length < 8) throw badRequest('Mínimo 8 caracteres')
  const passwordHash = await hashPassword(password)
  await deps.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('users')
      .set({ password_hash: passwordHash })
      .where('id', '=', auth.userId)
      .execute()
    await deleteUserSessions(trx, auth.userId, auth.sessionId)
    await enqueueEmail(trx, {
      to: auth.email,
      kind: 'password_changed',
      content: passwordChangedEmail(
        await greetingName(trx, auth.userId, auth.email),
        mailCtx(deps.config),
      ),
    })
  })
}

/** Lo que el frontend necesita saber del usuario conectado. */
export async function currentUser(db: Db, userId: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'email_verified_at', 'created_at'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  const roles = await db
    .selectFrom('user_roles')
    .select('role')
    .where('user_id', '=', userId)
    .execute()
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified_at !== null,
    createdAt: user.created_at,
    roles: roles.map((r) => r.role),
    isAdmin: roles.some((r) => r.role === 'admin'),
  }
}
