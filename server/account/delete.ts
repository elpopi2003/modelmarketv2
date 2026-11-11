import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from 'kysely'
import type { Db } from '../db/client'
import type { EmailContent, LayoutContext } from '../email/layout'
import { enqueueEmail } from '../email/outbox'
import { notifyFavoritersOfRemoval } from '../content/withdrawal'
import { badRequest, notFound } from '../http/reply'

export interface AccountDeps {
  db: Db
  uploadsDir: string
  mail: LayoutContext
}

/** Datos de contacto de un usuario: nombre para saludar y email. */
export async function contactOf(db: Db, userId: string) {
  const u = await db
    .selectFrom('users as u')
    .leftJoin('profiles as p', 'p.id', 'u.id')
    .select(['u.email', 'p.display_name', 'p.username'])
    .where('u.id', '=', userId)
    .executeTakeFirst()
  if (!u) throw notFound('Ese usuario no existe.')
  return { email: u.email, name: u.display_name || u.username || 'coleccionista' }
}

const isAdmin = (db: Db, userId: string) =>
  db
    .selectFrom('user_roles')
    .select('id')
    .where('user_id', '=', userId)
    .where('role', '=', 'admin')
    .executeTakeFirst()

/** ¿Quedaría la plataforma sin ningún administrador si este usuario dejara de serlo? */
export async function isLastAdmin(db: Db, userId: string) {
  if (!(await isAdmin(db, userId))) return false
  const r = await db
    .selectFrom('user_roles')
    .select(sql<number>`COUNT(*)`.as('n'))
    .where('role', '=', 'admin')
    .executeTakeFirstOrThrow()
  return Number(r.n) <= 1
}

/**
 * Borra una cuenta por completo: el usuario y, en cascada, perfil, roles, sesiones,
 * anuncios, peticiones, favoritos, ofertas, conversaciones y notificaciones; después, sus
 * fotos y avatares del disco. Antes avisa a quien tenía sus anuncios en favoritos.
 *
 * Los datos de contacto se leen ANTES de borrar (después no hay a quién preguntar) y el
 * email se encola en la misma transacción: si el borrado falla, no se anuncia una baja que
 * no ha ocurrido.
 *
 * Pendiente de la fase de pagos: cancelar antes la suscripción de Stripe si la hubiera.
 */
export async function deleteAccount(
  deps: AccountDeps,
  userId: string,
  email: (name: string, ctx: LayoutContext) => EmailContent,
  kind: string,
) {
  if (await isLastAdmin(deps.db, userId)) {
    throw badRequest(
      'Es la única cuenta de administrador: nombra antes a otro administrador.',
      'last_admin',
    )
  }
  const contact = await contactOf(deps.db, userId)
  await deps.db.transaction().execute(async (trx) => {
    // Sus anuncios desaparecen con la cuenta: aviso a quien los tenía en favoritos.
    const listings = await trx
      .selectFrom('listings')
      .select('id')
      .where('user_id', '=', userId)
      .execute()
    await notifyFavoritersOfRemoval(
      { db: trx, mail: deps.mail },
      listings.map((l) => l.id),
      'deleted',
    )
    await trx.deleteFrom('users').where('id', '=', userId).execute()
    await enqueueEmail(trx, { to: contact.email, kind, content: email(contact.name, deps.mail) })
  })
  // Fuera de la transacción: el disco no se puede deshacer, así que va solo si se borró.
  await rm(join(deps.uploadsDir, 'photos', userId), { recursive: true, force: true })
  await rm(join(deps.uploadsDir, 'avatars', userId), { recursive: true, force: true })
}
