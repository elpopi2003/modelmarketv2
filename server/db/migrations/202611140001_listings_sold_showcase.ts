import { sql, type Kysely } from 'kysely'

/**
 * sold_showcase: un anuncio vendido que sigue en el catálogo, con la banda «¡VENDIDA!».
 * Lo pone el importador masivo con la opción «Marcar como vendidas» (colecciones que se
 * enseñan aunque ya no estén a la venta). Los anuncios que su dueño marca como vendidos
 * no lo llevan y siguen desapareciendo del catálogo.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE listings
      ADD COLUMN sold_showcase TINYINT(1) NOT NULL DEFAULT 0 AFTER previous_status
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE listings DROP COLUMN sold_showcase`.execute(db)
}
