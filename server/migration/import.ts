import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { Db } from '../db/client'
import { toJson } from '../db/json'
import { saveAvatar, savePhoto } from '../uploads/images'
import type { Row, SourceData } from './source'

/**
 * Importa a MariaDB los datos leídos de Supabase (v2).
 *
 *  - Conserva todos los IDs (UUID) y el número de referencia de los anuncios.
 *  - Contraseñas: se copian los hashes bcrypt tal cual; el login los acepta y los recifra
 *    con argon2id la primera vez que cada persona entra. Nadie tiene que restablecerla.
 *  - Fotos y avatares de Supabase Storage: se descargan y se procesan igual que una subida
 *    nueva (WebP sin EXIF, con miniatura), y se reescriben sus URLs.
 *  - Fechas: llegan de Postgres como Date (instante absoluto) y se guardan en UTC, como
 *    todo lo que escribe la aplicación.
 *  - Todo en una transacción: o entra todo o no entra nada. Las fotos se guardan antes
 *    (si la transacción fallara quedarían ficheros sueltos, sin efecto visible).
 */
export interface ImportOptions {
  uploadsDir: string
  /** Descarga una imagen. Inyectable para los tests. */
  fetchImage?: (url: string) => Promise<Buffer>
  /** Vacía antes los datos de usuarios y contenido (ensayos repetidos en staging). */
  wipe?: boolean
  log?: (msg: string) => void
}

export interface ImportReport {
  counts: Record<string, number>
  photosMigrated: number
  photosFailed: { url: string; reason: string }[]
}

const STORAGE_MARK = '/storage/v1/object/public/'
const isSupabaseStorage = (url: unknown): url is string =>
  typeof url === 'string' && url.includes(STORAGE_MARK)

async function defaultFetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v))
const date = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string | Date))
const arr = <T = string>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

export async function importData(
  db: Db,
  data: SourceData,
  opts: ImportOptions,
): Promise<ImportReport> {
  const log = opts.log ?? (() => {})
  const fetchImage = opts.fetchImage ?? defaultFetchImage
  const report: ImportReport = { counts: {}, photosMigrated: 0, photosFailed: [] }

  // ── 0. Destino vacío (o vaciarlo a propósito) ─────────────────────────────
  if (opts.wipe) {
    log('Vaciando usuarios y contenido del destino…')
    await db.deleteFrom('reports').execute()
    await db.deleteFrom('users').execute() // en cascada: perfiles, contenido, mensajes…
    await rm(join(opts.uploadsDir, 'photos'), { recursive: true, force: true })
    await rm(join(opts.uploadsDir, 'avatars'), { recursive: true, force: true })
  }
  const existing = await db
    .selectFrom('users')
    .select(sql<number>`COUNT(*)`.as('n'))
    .executeTakeFirstOrThrow()
  if (Number(existing.n) > 0) {
    throw new Error(
      'El destino ya tiene usuarios. La importación es para una base de datos recién creada; ' +
        'para repetir un ensayo usa --wipe (borra los usuarios y su contenido del destino).',
    )
  }

  // ── 1. Fotos: descargar y recodificar ─────────────────────────────────────
  const photoMap = new Map<string, string | null>()
  async function migrate(url: unknown, ownerId: string, kind: 'photo' | 'avatar') {
    if (!isSupabaseStorage(url)) return typeof url === 'string' ? url : null
    if (photoMap.has(url)) return photoMap.get(url)!
    try {
      const buf = await fetchImage(url)
      const saved =
        kind === 'photo'
          ? await savePhoto(opts.uploadsDir, ownerId, buf)
          : await saveAvatar(opts.uploadsDir, ownerId, buf)
      photoMap.set(url, saved.url)
      report.photosMigrated++
      return saved.url
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      report.photosFailed.push({ url, reason })
      log(`  ! foto no migrada (${reason}): ${url}`)
      photoMap.set(url, null)
      return null
    }
  }
  const migratePhotos = async (row: Row, ownerId: string) => {
    const out: string[] = []
    for (const u of arr(row.photos_json ?? row.photos)) {
      const m = await migrate(u, ownerId, 'photo')
      if (m) out.push(m)
    }
    return out
  }

  log('Migrando fotos…')
  const listingPhotos = new Map<string, string[]>()
  for (const l of data.listings)
    listingPhotos.set(String(l.id), await migratePhotos(l, String(l.user_id)))
  const requestPhotos = new Map<string, string[]>()
  for (const r of data.requests)
    requestPhotos.set(String(r.id), await migratePhotos(r, String(r.user_id)))
  const avatars = new Map<string, string | null>()
  for (const p of data.profiles)
    avatars.set(String(p.id), await migrate(p.avatar_url, String(p.id), 'avatar'))

  // ── 2. Datos, en orden de dependencias y en una transacción ──────────────
  log('Importando datos…')
  await db.transaction().execute(async (trx) => {
    // Inserciones "en bruto": algunas columnas (ref_number) no se escriben desde la app.
    const t = trx as unknown as Kysely<Record<string, Record<string, unknown>>>
    const insert = async (table: string, rows: Record<string, unknown>[]) => {
      for (const r of rows) await t.insertInto(table).values(r).execute()
      report.counts[table] = (report.counts[table] ?? 0) + rows.length
    }

    await insert(
      'users',
      data.users.map((u) => ({
        id: u.id,
        email: String(u.email).trim().toLowerCase(),
        password_hash: str(u.encrypted_password) || null,
        email_verified_at: date(u.email_confirmed_at),
        last_login_at: date(u.last_sign_in_at),
        created_at: date(u.created_at),
      })),
    )

    const userIds = new Set(data.users.map((u) => String(u.id)))
    const profileIds = new Set(data.profiles.map((p) => String(p.id)))
    await insert('profiles', [
      ...data.profiles
        .filter((p) => userIds.has(String(p.id)))
        .map((p) => ({
          id: p.id,
          username: str(p.username),
          display_name: str(p.display_name),
          avatar_url: avatars.get(String(p.id)) ?? null,
          bio: str(p.bio),
          location: str(p.location),
          notify_email: p.notify_email !== false,
          notify_push: p.notify_push === true,
          created_at: date(p.created_at),
        })),
      // Una cuenta sin perfil no debería existir, pero si existe se le crea uno mínimo.
      ...data.users
        .filter((u) => !profileIds.has(String(u.id)))
        .map((u) => ({ id: u.id, display_name: String(u.email).split('@')[0] })),
    ])

    await insert(
      'user_roles',
      data.user_roles
        .filter((r) => userIds.has(String(r.user_id)))
        .map((r) => ({
          id: r.id,
          user_id: r.user_id,
          role: oneOf(r.role, ['admin', 'user'], 'user'),
          created_at: date(r.created_at),
        })),
    )
    await insert(
      'user_suspensions',
      data.user_suspensions
        .filter((s) => userIds.has(String(s.user_id)))
        .map((s) => ({
          user_id: s.user_id,
          reason: String(s.reason ?? ''),
          suspended_at: date(s.suspended_at),
          suspended_by:
            s.suspended_by && userIds.has(String(s.suspended_by)) ? s.suspended_by : null,
        })),
    )

    // Catálogos: las semillas ya existen con los mismos IDs; se añaden las nuevas.
    for (const c of data.categories) {
      await t
        .insertInto('categories')
        .values({ id: c.id, name: c.name, slug: c.slug, parent_id: c.parent_id ?? null })
        .onDuplicateKeyUpdate({ name: c.name })
        .execute()
    }
    for (const b of data.brands) {
      await t
        .insertInto('brands')
        .values({ id: b.id, name: b.name, slug: b.slug })
        .onDuplicateKeyUpdate({ name: b.name })
        .execute()
    }
    report.counts.categories = data.categories.length
    report.counts.brands = data.brands.length

    const statuses = ['draft', 'active', 'reserved', 'sold', 'archived'] as const
    await insert(
      'listings',
      data.listings.map((l) => ({
        id: l.id,
        ref_number: l.ref_number,
        user_id: l.user_id,
        title: l.title,
        description: str(l.description),
        price_cents: Number(l.price_cents ?? 0),
        currency: str(l.currency) ?? 'EUR',
        condition: oneOf(l.condition, ['sealed', 'opened', 'started'], 'sealed'),
        decals: oneOf(l.decals, ['perfect', 'yellowed', 'unavailable'], 'perfect'),
        scale: str(l.scale),
        category_id: l.category_id ?? null,
        brand_id: l.brand_id ?? null,
        photos: toJson(listingPhotos.get(String(l.id)) ?? []),
        status: oneOf(l.status, statuses, 'active'),
        previous_status: l.previous_status ? oneOf(l.previous_status, statuses, 'active') : null,
        shipping_inpost: l.shipping_inpost === true,
        hand_delivery: l.hand_delivery === true,
        accepts_offers: l.accepts_offers !== false,
        views: Number(l.views ?? 0),
        visible_at: date(l.visible_at),
        created_at: date(l.created_at),
        updated_at: date(l.updated_at),
      })),
    )

    const reqStatuses = ['open', 'fulfilled', 'closed'] as const
    await insert(
      'requests',
      data.requests.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        description: str(r.description),
        category_id: r.category_id ?? null,
        brand_id: r.brand_id ?? null,
        scale: str(r.scale),
        max_price_cents:
          r.max_price_cents === null || r.max_price_cents === undefined
            ? null
            : Number(r.max_price_cents),
        photos: toJson(requestPhotos.get(String(r.id)) ?? []),
        accepted_conditions: toJson(arr(r.conditions_json ?? r.accepted_conditions)),
        decals_requirement: oneOf(
          r.decals_requirement,
          ['any', 'perfect', 'yellowed', 'unavailable'],
          'any',
        ),
        urgency: oneOf(r.urgency, ['no_rush', 'normal', 'urgent'], 'no_rush'),
        // v2 tenía valores sueltos en el enum (PENDING, SUCCESS, ERROR) sin uso: se cierran.
        status: oneOf(r.status, reqStatuses, 'closed'),
        previous_status: r.previous_status ? oneOf(r.previous_status, reqStatuses, 'open') : null,
        created_at: date(r.created_at),
        updated_at: date(r.updated_at),
      })),
    )

    await insert(
      'favorites',
      data.favorites.map((f) => ({
        id: f.id,
        user_id: f.user_id,
        listing_id: f.listing_id,
        created_at: date(f.created_at),
      })),
    )
    await insert(
      'conversations',
      data.conversations.map((c) => ({
        id: c.id,
        listing_id: c.listing_id ?? null,
        request_id: c.request_id ?? null,
        buyer_id: c.buyer_id,
        seller_id: c.seller_id,
        buyer_deleted_at: date(c.buyer_deleted_at),
        seller_deleted_at: date(c.seller_deleted_at),
        created_at: date(c.created_at),
        updated_at: date(c.updated_at),
      })),
    )
    await insert(
      'messages',
      data.messages.map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        body: String(m.body ?? ''),
        kind: oneOf(m.kind, ['text', 'offer'], 'text'),
        read_at: date(m.read_at),
        created_at: date(m.created_at),
      })),
    )
    await insert(
      'offers',
      data.offers.map((o) => ({
        id: o.id,
        listing_id: o.listing_id ?? null,
        request_id: o.request_id ?? null,
        from_user_id: o.from_user_id,
        to_user_id: o.to_user_id,
        conversation_id: o.conversation_id ?? null,
        amount_cents: Number(o.amount_cents),
        message: str(o.message),
        status: oneOf(o.status, ['pending', 'accepted', 'rejected', 'withdrawn'], 'withdrawn'),
        created_at: date(o.created_at),
        updated_at: date(o.updated_at),
      })),
    )
    await insert(
      'notifications',
      data.notifications
        .filter((n) => userIds.has(String(n.user_id)))
        .map((n) => ({
          id: n.id,
          user_id: n.user_id,
          type: String(n.type),
          title: String(n.title).slice(0, 200),
          body: str(n.body),
          link: str(n.link),
          read_at: date(n.read_at),
          created_at: date(n.created_at),
        })),
    )
    await insert(
      'reports',
      data.reports.map((r) => ({
        id: r.id,
        reporter_id: r.reporter_id,
        listing_id: r.listing_id ?? null,
        request_id: r.request_id ?? null,
        reported_user_id: r.reported_user_id ?? null,
        reason: oneOf(
          r.reason,
          ['spam', 'prohibited', 'counterfeit', 'misleading', 'offensive', 'other'],
          'other',
        ),
        details: str(r.details),
        status: oneOf(r.status, ['pending', 'resolved', 'dismissed'], 'pending'),
        resolved_by: r.resolved_by && userIds.has(String(r.resolved_by)) ? r.resolved_by : null,
        resolved_at: date(r.resolved_at),
        resolution_note: str(r.resolution_note),
        created_at: date(r.created_at),
        updated_at: date(r.updated_at),
      })),
    )
    await insert(
      'subscriptions',
      data.subscriptions
        .filter((s) => userIds.has(String(s.user_id)))
        .map((s) => ({
          id: s.id,
          user_id: s.user_id,
          tier: oneOf(s.tier, ['free', 'pro', 'retail'], 'free'),
          status: String(s.status ?? 'active'),
          stripe_customer_id: str(s.stripe_customer_id),
          stripe_subscription_id: str(s.stripe_subscription_id),
          current_period_end: date(s.current_period_end),
          created_at: date(s.created_at),
          updated_at: date(s.updated_at),
        })),
    )
  })

  return report
}
