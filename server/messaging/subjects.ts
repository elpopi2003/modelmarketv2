import type { Db } from '../db/client'
import { jsonArray } from '../db/json'
import { listingVisibleTo, requestVisibleTo, type Viewer } from '../content/viewer'

/**
 * "Asunto" de una conversación u oferta: el anuncio o la petición del que cuelga, tal y
 * como lo puede ver quien pregunta. Si se retiró por moderación o ya no es visible, no
 * aparece: la conversación se conserva, pero se muestra "no disponible" y sin enlace.
 */
export interface Subject {
  kind: 'listing' | 'request'
  title: string
  available: boolean
  cover: string | null
  link: string | null
}

export async function resolveSubjects(
  db: Db,
  viewer: NonNullable<Viewer>,
  refs: { listingId: string | null; requestId: string | null }[],
) {
  const listingIds = [...new Set(refs.map((r) => r.listingId).filter((x): x is string => !!x))]
  const requestIds = [...new Set(refs.map((r) => r.requestId).filter((x): x is string => !!x))]

  const [listings, requests] = await Promise.all([
    listingIds.length
      ? db
          .selectFrom('listings')
          .select(['id', 'title', 'photos'])
          .where('id', 'in', listingIds)
          .where(listingVisibleTo(viewer))
          .execute()
      : [],
    requestIds.length
      ? db
          .selectFrom('requests')
          .select(['id', 'title', 'photos'])
          .where('id', 'in', requestIds)
          .where(requestVisibleTo(viewer))
          .execute()
      : [],
  ])
  const lmap = new Map(listings.map((l) => [l.id, l]))
  const rmap = new Map(requests.map((r) => [r.id, r]))

  return (ref: { listingId: string | null; requestId: string | null }): Subject => {
    const kind = ref.listingId ? 'listing' : 'request'
    const row = ref.listingId
      ? lmap.get(ref.listingId)
      : ref.requestId
        ? rmap.get(ref.requestId)
        : undefined
    if (!row) {
      return {
        kind,
        title: kind === 'listing' ? 'Anuncio no disponible' : 'Petición no disponible',
        available: false,
        cover: null,
        link: null,
      }
    }
    return {
      kind,
      title: row.title,
      available: true,
      cover: jsonArray<string>(row.photos)[0] ?? null,
      link: kind === 'listing' ? `/producto/${row.id}` : `/peticion/${row.id}`,
    }
  }
}

/** Nombre visible y avatar de varios usuarios. */
export async function resolvePeople(db: Db, ids: string[]) {
  const unique = [...new Set(ids)]
  const rows = unique.length
    ? await db
        .selectFrom('profiles')
        .select(['id', 'display_name', 'username', 'avatar_url'])
        .where('id', 'in', unique)
        .execute()
    : []
  const map = new Map(rows.map((p) => [p.id, p]))
  return (id: string) => {
    const p = map.get(id)
    return { name: p?.display_name || p?.username || 'Usuario', avatar: p?.avatar_url ?? null }
  }
}
