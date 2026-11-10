import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { brandSlug, getOrCreateBrand } from '../../content/catalog'
import type { Db } from '../../db/client'
import { toJson } from '../../db/json'
import type { DecalsStatus, ListingCondition } from '../../db/schema'
import { badRequest, notFound } from '../../http/reply'
import { deleteUploads, savePhoto } from '../../uploads/images'
import { normKey, type SheetRow } from './files'

/**
 * Importador masivo de maquetas desde un Excel de colección (+ ZIP de imágenes), solo
 * para administradores. Dos pasos con los mismos ficheros:
 *
 *  1. analyzeImport: vista previa fila a fila (qué entra, qué se salta y por qué) sin
 *     escribir nada.
 *  2. runImport: vuelve a analizar y crea los anuncios de las filas válidas.
 *
 * Reglas (decididas con el usuario):
 *  - Filas sin precio o sin imagen en el ZIP: no se importan.
 *  - Ya existentes en la cuenta destino (misma marca + referencia, o marca + título si no
 *    hay referencia) o repetidas en el propio Excel: se saltan.
 *  - Estado: el del Excel si viene; si no, "Por montar" = Abierto y "En construcción" = Empezado.
 *  - Cantidad > 1: un solo anuncio con "Unidades disponibles: N" en la descripción.
 *  - La imagen es de catálogo (caja oficial): se marca para que la interfaz lo indique.
 *  - Se publica al momento y sin aplicar los límites del plan del destinatario: es una
 *    acción de administración.
 */

export interface ImportBatchOptions {
  shippingAvailable: boolean
  handDelivery: boolean
  acceptsOffers: boolean
  decals: DecalsStatus
}

export interface PreviewRow {
  row: number
  brand: string
  brandIsNew: boolean
  reference: string | null
  title: string
  scale: string | null
  /** Categoría tal como viene en el Excel. */
  categorySource: string | null
  /** Categoría deducida; null si hay que elegirla en la vista previa. */
  categoryId: string | null
  needsCategory: boolean
  condition: ListingCondition
  priceCents: number | null
  quantity: number
  hasImage: boolean
  status: 'ok' | 'skip'
  skipReason: string | null
  warnings: string[]
}

/** Marcas que en los ficheros de colección aparecen con otro nombre. */
const BRAND_ALIASES: Record<string, string> = {
  mengmodel: 'Meng',
  bandaispirits: 'Bandai',
  hobbyboss: 'HobbyBoss',
}

/** Categorías del Excel (inglés o español, normalizadas) → slug de ModelMarket. */
const CATEGORY_ALIASES: Record<string, string> = {
  aircraft: 'aviacion',
  aviacion: 'aviacion',
  aviones: 'aviacion',
  helicopters: 'aviacion',
  cars: 'automoviles',
  car: 'automoviles',
  coches: 'automoviles',
  automoviles: 'automoviles',
  motorcycles: 'automoviles',
  space: 'ciencia-ficcion',
  scifi: 'ciencia-ficcion',
  sciencefiction: 'ciencia-ficcion',
  cienciaficcion: 'ciencia-ficcion',
  ships: 'barcos',
  ship: 'barcos',
  barcos: 'barcos',
  figures: 'figuras',
  figuras: 'figuras',
  armor: 'vehiculos-militares',
  armour: 'vehiculos-militares',
  military: 'vehiculos-militares',
  militaryvehicles: 'vehiculos-militares',
  vehiculosmilitares: 'vehiculos-militares',
  tanks: 'vehiculos-militares',
  trains: 'trenes',
  trenes: 'trenes',
  tools: 'pinturas-accesorios',
  paints: 'pinturas-accesorios',
  accessories: 'pinturas-accesorios',
}

function mapCondition(r: SheetRow): { condition: ListingCondition; warning?: string } {
  const explicit = normKey(r.condition ?? '')
  if (['precintado', 'sealed', 'nuevo', 'new'].includes(explicit)) return { condition: 'sealed' }
  if (['abierto', 'opened', 'open'].includes(explicit)) return { condition: 'opened' }
  if (['empezado', 'started', 'enconstruccion'].includes(explicit)) return { condition: 'started' }
  const shelf = normKey(r.shelf ?? '')
  if (['enconstruccion', 'inprogress', 'empezado'].includes(shelf)) return { condition: 'started' }
  if (['montado', 'terminado', 'completado', 'completed', 'built'].includes(shelf)) {
    return { condition: 'started', warning: 'En el Excel figura como montado: revisa el estado.' }
  }
  return { condition: 'opened' }
}

function canonicalBrand(raw: string) {
  return BRAND_ALIASES[normKey(raw)] ?? raw.trim().replace(/\s+/g, ' ')
}

function buildDescription(r: SheetRow, quantity: number): string {
  const lines: string[] = []
  if (r.notes) lines.push(r.notes)
  const facts = [
    quantity > 1 ? `Unidades disponibles: ${quantity}` : null,
    r.year ? `Año de edición: ${r.year}` : null,
    r.reference ? `Referencia del fabricante: ${r.reference}` : null,
    r.link && /^https?:\/\//.test(r.link) ? `Ficha del kit: ${r.link}` : null,
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join('\n'))
  return lines.join('\n\n').slice(0, 2000)
}

/** Clave de deduplicación: marca + referencia, o marca + título si no hay referencia. */
const dedupeKey = (brand: string, reference: string | null, title: string) =>
  `${brandSlug(brand)}|${reference ? `ref:${normKey(reference)}` : `title:${normKey(title)}`}`

/** Imagen del ZIP para una fila: primero "marca-referencia", después solo "referencia". */
function imageKeyFor(r: SheetRow, brand: string, images: Map<string, Buffer>) {
  if (!r.reference) return null
  for (const k of [
    normKey(`${brand}${r.reference}`),
    normKey(`${r.brand ?? ''}${r.reference}`),
    normKey(r.reference),
  ]) {
    if (k && images.has(k)) return k
  }
  return null
}

interface Analysis {
  rows: PreviewRow[]
  imageKeys: Map<number, string>
  descriptions: Map<number, string>
  summary: {
    total: number
    toImport: number
    skipped: number
    needCategory: number
    newBrands: string[]
    unknownCategories: string[]
  }
}

export async function analyzeImport(
  db: Db,
  ownerId: string,
  sheet: SheetRow[],
  images: Map<string, Buffer>,
): Promise<Analysis> {
  const owner = await db
    .selectFrom('users')
    .select('id')
    .where('id', '=', ownerId)
    .executeTakeFirst()
  if (!owner) throw notFound('La cuenta destinataria no existe.')

  const [brands, categories, existing] = await Promise.all([
    db.selectFrom('brands').select(['slug']).execute(),
    db.selectFrom('categories').select(['id', 'slug']).execute(),
    db
      .selectFrom('listings as l')
      .leftJoin('brands as b', 'b.id', 'l.brand_id')
      .select(['b.name as brand', 'l.manufacturer_ref', 'l.title'])
      .where('l.user_id', '=', ownerId)
      .execute(),
  ])
  const brandSlugs = new Set(brands.map((b) => b.slug))
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]))
  const seen = new Set(existing.map((e) => dedupeKey(e.brand ?? '', e.manufacturer_ref, e.title)))
  const inFile = new Set<string>()

  const rows: PreviewRow[] = []
  const imageKeys = new Map<number, string>()
  const descriptions = new Map<number, string>()
  const newBrands = new Set<string>()
  const unknownCategories = new Set<string>()

  for (const r of sheet) {
    const warnings: string[] = []
    const brand = canonicalBrand(r.brand ?? '')
    let title = (r.name ?? '').trim()
    if (title.length > 120) {
      title = `${title.slice(0, 119)}…`
      warnings.push('Título recortado a 120 caracteres.')
    }
    const text = `${r.name ?? ''} ${r.notes ?? ''}`
    if (text.includes('�'))
      warnings.push('El texto trae caracteres dañados en origen: revísalo tras importar.')

    const { condition, warning } = mapCondition(r)
    if (warning) warnings.push(warning)
    const catSlug = r.category ? CATEGORY_ALIASES[normKey(r.category)] : undefined
    const categoryId = catSlug ? (categoryIdBySlug.get(catSlug) ?? null) : null
    if (!categoryId && r.category) unknownCategories.add(r.category)
    const quantity = r.quantity && r.quantity > 1 ? Math.floor(r.quantity) : 1
    const priceCents = r.price !== null && r.price > 0 ? Math.round(r.price * 100) : null
    const imageKey = brand ? imageKeyFor(r, brand, images) : null
    const brandIsNew = !!brand && !brandSlugs.has(brandSlug(brand))

    let skipReason: string | null = null
    const key = dedupeKey(brand, r.reference, title)
    if (!brand) skipReason = 'Falta la marca.'
    else if (title.length < 3) skipReason = 'Falta el nombre (mínimo 3 caracteres).'
    else if (priceCents === null) skipReason = 'Sin precio.'
    else if (priceCents > 100_000_000) skipReason = 'Precio demasiado alto.'
    else if (!imageKey) skipReason = 'Sin imagen en el ZIP.'
    else if (seen.has(key)) skipReason = 'Ya existe en esa cuenta.'
    else if (inFile.has(key)) skipReason = 'Repetida en el propio Excel.'

    if (!skipReason) {
      inFile.add(key)
      imageKeys.set(r.row, imageKey!)
      descriptions.set(r.row, buildDescription(r, quantity))
      if (brandIsNew) newBrands.add(brand)
    }

    rows.push({
      row: r.row,
      brand,
      brandIsNew,
      reference: r.reference,
      title,
      scale: r.scale ? r.scale.replace(';', ':').slice(0, 20) : null,
      categorySource: r.category,
      categoryId,
      needsCategory: !skipReason && !categoryId,
      condition,
      priceCents,
      quantity,
      hasImage: !!imageKey,
      status: skipReason ? 'skip' : 'ok',
      skipReason,
      warnings,
    })
  }

  const ok = rows.filter((r) => r.status === 'ok')
  return {
    rows,
    imageKeys,
    descriptions,
    summary: {
      total: rows.length,
      toImport: ok.length,
      skipped: rows.length - ok.length,
      needCategory: ok.filter((r) => r.needsCategory).length,
      newBrands: [...newBrands].sort(),
      unknownCategories: [...unknownCategories].sort(),
    },
  }
}

/** Procesa con N tareas a la vez (sharp ya usa varios hilos; 4 es un buen equilibrio). */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export interface RunImportInput {
  ownerId: string
  options: ImportBatchOptions
  /** Categoría elegida en la vista previa por número de fila (null = sin categoría). */
  categories: Record<string, string | null>
}

export async function runImport(
  deps: { db: Db; uploadsDir: string },
  sheet: SheetRow[],
  images: Map<string, Buffer>,
  input: RunImportInput,
) {
  const { db } = deps
  const analysis = await analyzeImport(db, input.ownerId, sheet, images)
  const toImport = analysis.rows.filter((r) => r.status === 'ok')

  const validCategories = new Set(
    (await db.selectFrom('categories').select('id').execute()).map((c) => c.id),
  )
  for (const r of toImport) {
    if (!r.needsCategory) continue
    const chosen = input.categories[String(r.row)]
    if (chosen === undefined) {
      throw badRequest(
        `Falta elegir la categoría de la fila ${r.row} («${r.title}»).`,
        'category_required',
      )
    }
    if (chosen !== null && !validCategories.has(chosen))
      throw badRequest(`Categoría no válida en la fila ${r.row}.`)
  }
  if (toImport.length === 0)
    throw badRequest('No hay ninguna fila que importar.', 'nothing_to_import')

  // 1. Fotos (lo más lento), fuera de la transacción.
  const photos = await pool(toImport, 4, async (r) => {
    const { url } = await savePhoto(
      deps.uploadsDir,
      input.ownerId,
      images.get(analysis.imageKeys.get(r.row)!)!,
    )
    return url
  })

  // 2. Anuncios, todos o ninguno.
  try {
    await db.transaction().execute(async (trx) => {
      for (const [i, r] of toImport.entries()) {
        const brandId = await getOrCreateBrand(trx, r.brand)
        await trx
          .insertInto('listings')
          .values({
            id: randomUUID(),
            user_id: input.ownerId,
            title: r.title,
            description: analysis.descriptions.get(r.row) || null,
            price_cents: r.priceCents!,
            condition: r.condition,
            decals: input.options.decals,
            scale: r.scale,
            category_id: r.needsCategory ? input.categories[String(r.row)] : r.categoryId,
            brand_id: brandId,
            manufacturer_ref: r.reference?.slice(0, 50) ?? null,
            photos: toJson([photos[i]]),
            catalog_photo: photos[i],
            previous_status: null,
            shipping_inpost: input.options.shippingAvailable,
            hand_delivery: input.options.handDelivery,
            accepts_offers: input.options.acceptsOffers,
            visible_at: sql<Date>`NOW(3)`,
          })
          .execute()
      }
    })
  } catch (err) {
    await deleteUploads(deps.uploadsDir, photos)
    throw err
  }

  return {
    created: toImport.length,
    skipped: analysis.rows
      .filter((r) => r.status === 'skip')
      .map((r) => ({ row: r.row, title: r.title, reason: r.skipReason })),
    newBrands: analysis.summary.newBrands,
  }
}
