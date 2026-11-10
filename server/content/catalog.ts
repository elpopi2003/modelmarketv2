import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client'
import { isDuplicateKey } from '../db/errors'
import { badRequest } from '../http/reply'

export const listCategories = (db: Db) =>
  db.selectFrom('categories').selectAll().orderBy('name').execute()

export const listBrands = (db: Db) => db.selectFrom('brands').selectAll().orderBy('name').execute()

/** "Tamiya", " TAMIYA " y "tamiya" son la misma marca: se deduplica por slug. */
export function brandSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Devuelve el id de la marca, creándola si no existe ("Otra" en los formularios). */
export async function getOrCreateBrand(db: Db, rawName: string): Promise<string> {
  const name = rawName.trim().replace(/\s+/g, ' ')
  const slug = brandSlug(name)
  if (!slug) throw badRequest('Nombre de marca inválido.')

  const existing = await db
    .selectFrom('brands')
    .select('id')
    .where('slug', '=', slug)
    .executeTakeFirst()
  if (existing) return existing.id

  const id = randomUUID()
  try {
    await db.insertInto('brands').values({ id, name, slug }).execute()
    return id
  } catch (err) {
    // Otra petición la creó a la vez, o el nombre exacto existe con otro slug.
    if (!isDuplicateKey(err)) throw err
    const again = await db
      .selectFrom('brands')
      .select('id')
      .where((eb) => eb.or([eb('slug', '=', slug), eb('name', '=', name)]))
      .executeTakeFirstOrThrow()
    return again.id
  }
}
