import { randomUUID } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { sql } from 'kysely'
import sharp from 'sharp'
import type { Db } from '../db/client'
import { badRequest } from '../http/reply'

/**
 * Fotos y avatares en el disco del VPS.
 *
 * Todo lo que sube un usuario se recodifica a WebP: así no se guarda nada tal y como
 * llega (un "JPEG" que en realidad es otra cosa no sobrevive a la decodificación) y se
 * descartan los metadatos EXIF, incluida la ubicación GPS que llevan muchas fotos de móvil.
 *
 *   /uploads/photos/<userId>/<id>.webp      hasta 1600 px (ficha)
 *   /uploads/photos/<userId>/<id>-sm.webp   hasta 600 px (tarjetas)
 *   /uploads/avatars/<userId>/<id>.webp     512×512 recortado
 */
export const UPLOADS_URL_PREFIX = '/uploads'
export type UploadKind = 'photos' | 'avatars'

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_INPUT_PIXELS = 50_000_000

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** ¿Es una URL de algo que subió este usuario, del tipo indicado? */
export function isOwnUpload(url: string, userId: string, kind: UploadKind): boolean {
  return new RegExp(`^${UPLOADS_URL_PREFIX}/${kind}/${userId}/${UUID}\\.webp$`, 'i').test(url)
}

/** ¿Es una URL de nuestro almacenamiento (de cualquier usuario)? */
export function isLocalUpload(url: string): boolean {
  return new RegExp(`^${UPLOADS_URL_PREFIX}/(photos|avatars)/${UUID}/${UUID}\\.webp$`, 'i').test(
    url,
  )
}

function decoder(input: Buffer) {
  return sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate()
}

async function assertImage(input: Buffer) {
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
    if (!meta.width || !meta.height) throw new Error('sin dimensiones')
  } catch {
    throw badRequest(
      'El archivo no es una imagen válida (usa JPG, PNG, WebP o AVIF).',
      'invalid_image',
    )
  }
}

export async function savePhoto(uploadsDir: string, userId: string, input: Buffer) {
  await assertImage(input)
  const id = randomUUID()
  const dir = join(uploadsDir, 'photos', userId)
  await mkdir(dir, { recursive: true })
  await decoder(input)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(dir, `${id}.webp`))
  await decoder(input)
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(join(dir, `${id}-sm.webp`))
  return { url: `${UPLOADS_URL_PREFIX}/photos/${userId}/${id}.webp` }
}

export async function saveAvatar(uploadsDir: string, userId: string, input: Buffer) {
  await assertImage(input)
  const id = randomUUID()
  const dir = join(uploadsDir, 'avatars', userId)
  await mkdir(dir, { recursive: true })
  await decoder(input)
    .resize({ width: 512, height: 512, fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(join(dir, `${id}.webp`))
  return { url: `${UPLOADS_URL_PREFIX}/avatars/${userId}/${id}.webp` }
}

/** Ruta en disco de una URL local. null si no es nuestra (o intenta salirse de la carpeta). */
function pathOf(uploadsDir: string, url: string): string | null {
  if (!isLocalUpload(url)) return null
  const root = resolve(uploadsDir)
  const full = resolve(root, url.slice(UPLOADS_URL_PREFIX.length + 1))
  return full.startsWith(root) ? full : null
}

/** ¿Existe el fichero de esa URL en el disco? */
export async function uploadExists(uploadsDir: string, url: string): Promise<boolean> {
  const path = pathOf(uploadsDir, url)
  if (!path) return false
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Borra del disco las fotos indicadas (y sus miniaturas). Ignora las que no son locales. */
export async function deleteUploads(uploadsDir: string, urls: string[]) {
  for (const url of urls) {
    const path = pathOf(uploadsDir, url)
    if (!path) continue
    await rm(path, { force: true })
    await rm(path.replace(/\.webp$/, '-sm.webp'), { force: true })
  }
}

/**
 * De una lista de URLs, las que ya no usa ningún anuncio ni petición. Antes de borrar una
 * foto se comprueba: la misma URL puede estar en más de un sitio (p. ej. vía API).
 */
export async function unreferencedPhotos(db: Db, urls: string[]): Promise<string[]> {
  const result: string[] = []
  for (const url of new Set(urls)) {
    if (!isLocalUpload(url)) continue
    const quoted = JSON.stringify(url)
    const used = await db
      .selectFrom('listings')
      .select('id')
      .where(sql<boolean>`JSON_CONTAINS(photos, ${quoted})`)
      .unionAll(
        db
          .selectFrom('requests')
          .select('id')
          .where(sql<boolean>`JSON_CONTAINS(photos, ${quoted})`),
      )
      .limit(1)
      .executeTakeFirst()
    if (!used) result.push(url)
  }
  return result
}
