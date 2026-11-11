import { sql, type Kysely } from 'kysely'

/**
 * withdrawal_notified_at: cuándo se avisó a quien guardó el anuncio de que su dueño lo ha
 * retirado del catálogo. Limita el aviso a uno por semana y anuncio, para que suspender y
 * reactivar varias veces no se convierta en una ristra de correos.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE favorites ADD COLUMN withdrawal_notified_at DATETIME(3) NULL AFTER listing_id
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE favorites DROP COLUMN withdrawal_notified_at`.execute(db)
}
