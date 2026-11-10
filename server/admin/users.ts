import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { deleteUserSessions } from '../auth/sessions'
import {
  accountDeletedByAdminEmail,
  reinstatementEmail,
  suspensionEmail,
} from '../email/templates/account'
import { enqueueEmail } from '../email/outbox'
import { badRequest } from '../http/reply'
import { contactOf, deleteAccount, isLastAdmin, type AccountDeps } from '../account/delete'
import type { Db } from '../db/client'

/** Fila del panel de usuarios. Misma forma que la RPC `admin_users` de v2. */
export interface AdminUserRow {
  id: string
  email: string
  display_name: string | null
  username: string | null
  location: string | null
  avatar_url: string | null
  is_admin: boolean
  tier: 'free' | 'pro' | 'retail'
  listings_count: number
  requests_count: number
  reports_count: number
  created_at: Date
  suspended_at: Date | null
  suspension_reason: string | null
}

export async function listUsers(db: Db): Promise<AdminUserRow[]> {
  const { rows } = await sql<Record<string, unknown>>`
    SELECT
      p.id, u.email, p.display_name, p.username, p.location, p.avatar_url,
      EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'admin') AS is_admin,
      COALESCE((SELECT s.tier FROM subscriptions s
                 WHERE s.user_id = p.id AND s.status IN ('active', 'trialing')), 'free') AS tier,
      (SELECT COUNT(*) FROM listings l WHERE l.user_id = p.id) AS listings_count,
      (SELECT COUNT(*) FROM requests q WHERE q.user_id = p.id) AS requests_count,
      (SELECT COUNT(*) FROM reports rp
        WHERE rp.reported_user_id = p.id
           OR rp.listing_id IN (SELECT l.id FROM listings l WHERE l.user_id = p.id)
           OR rp.request_id IN (SELECT q.id FROM requests q WHERE q.user_id = p.id)) AS reports_count,
      p.created_at, sus.suspended_at, sus.reason AS suspension_reason
    FROM profiles p
    JOIN users u ON u.id = p.id
    LEFT JOIN user_suspensions sus ON sus.user_id = p.id
    ORDER BY p.created_at DESC
  `.execute(db)
  return rows.map((r) => ({
    ...(r as unknown as AdminUserRow),
    is_admin: Number(r.is_admin) === 1,
    listings_count: Number(r.listings_count),
    requests_count: Number(r.requests_count),
    reports_count: Number(r.reports_count),
  }))
}

/**
 * Suspende una cuenta: la saca de todas sus sesiones, oculta su contenido y le envía el
 * motivo por email. Su contenido no se borra.
 */
export async function suspendUser(
  deps: AccountDeps,
  adminId: string,
  targetId: string,
  reason: string,
) {
  if (targetId === adminId) throw badRequest('No puedes suspenderte a ti mismo.')
  const contact = await contactOf(deps.db, targetId)
  const targetIsAdmin = await deps.db
    .selectFrom('user_roles')
    .select('id')
    .where('user_id', '=', targetId)
    .where('role', '=', 'admin')
    .executeTakeFirst()
  // Si se suspendiera a un admin (o a varios en cadena), podría no quedar nadie para levantarlo.
  if (targetIsAdmin)
    throw badRequest('No se puede suspender a un administrador: quítale antes el rol.')

  await deps.db.transaction().execute(async (trx) => {
    await trx
      .insertInto('user_suspensions')
      .values({ user_id: targetId, reason, suspended_by: adminId })
      .onDuplicateKeyUpdate({ reason, suspended_by: adminId, suspended_at: sql<Date>`NOW(3)` })
      .execute()
    await deleteUserSessions(trx, targetId)
    await enqueueEmail(trx, {
      to: contact.email,
      kind: 'account_suspended',
      content: suspensionEmail(contact.name, reason, deps.mail),
    })
  })
}

export async function unsuspendUser(deps: AccountDeps, targetId: string) {
  const contact = await contactOf(deps.db, targetId)
  await deps.db.transaction().execute(async (trx) => {
    const r = await trx
      .deleteFrom('user_suspensions')
      .where('user_id', '=', targetId)
      .executeTakeFirst()
    if (Number(r.numDeletedRows) === 0) throw badRequest('Esta cuenta no está suspendida.')
    await enqueueEmail(trx, {
      to: contact.email,
      kind: 'account_reinstated',
      content: reinstatementEmail(contact.name, deps.mail),
    })
  })
}

export async function deleteUserAsAdmin(deps: AccountDeps, adminId: string, targetId: string) {
  if (targetId === adminId) throw badRequest('Usa Configuración para eliminar tu propia cuenta.')
  await deleteAccount(deps, targetId, accountDeletedByAdminEmail, 'account_deleted_by_admin')
}

/** Dar o quitar el rol de administrador. Nadie se lo quita a sí mismo y siempre queda uno. */
export async function setAdmin(db: Db, adminId: string, targetId: string, makeAdmin: boolean) {
  await contactOf(db, targetId) // 404 si no existe
  if (makeAdmin) {
    await db
      .insertInto('user_roles')
      .values({ id: randomUUID(), user_id: targetId, role: 'admin' })
      .onDuplicateKeyUpdate({ role: 'admin' })
      .execute()
    return
  }
  if (targetId === adminId)
    throw badRequest('No puedes retirarte a ti mismo el rol de administrador.')
  if (await isLastAdmin(db, targetId)) throw badRequest('Debe quedar al menos un administrador.')
  await db
    .deleteFrom('user_roles')
    .where('user_id', '=', targetId)
    .where('role', '=', 'admin')
    .execute()
}
