import { sql, type Kysely } from 'kysely'

/**
 * Campos para el importador masivo de maquetas (Excel):
 *  - manufacturer_ref: referencia del fabricante (p. ej. Tamiya 24229). Se muestra en la
 *    ficha y, junto a dueño y marca, evita duplicar al reimportar el mismo Excel.
 *  - catalog_photo: URL de la foto que es imagen de catálogo (la caja oficial, no una foto
 *    real del artículo). La interfaz la etiqueta como «Foto de catálogo»; si el dueño la
 *    quita del anuncio, el campo se vacía.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE listings
      ADD COLUMN manufacturer_ref VARCHAR(50)  NULL AFTER brand_id,
      ADD COLUMN catalog_photo    VARCHAR(500) NULL AFTER photos,
      ADD KEY listings_owner_brand_ref_idx (user_id, brand_id, manufacturer_ref)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE listings
      DROP KEY listings_owner_brand_ref_idx,
      DROP COLUMN catalog_photo,
      DROP COLUMN manufacturer_ref
  `.execute(db)
}
