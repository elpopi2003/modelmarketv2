import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MAX_EXCEL_BYTES, MAX_ZIP_BYTES, readImagesZip, readWorkbook } from '../admin/import/files'
import { analyzeImport, runImport } from '../admin/import/import'
import { requireAdmin } from '../auth/plugin'
import { HttpError, badRequest, ok } from '../http/reply'
import { parse } from '../http/validate'

const optionsSchema = z.object({
  shippingAvailable: z.boolean().default(false),
  handDelivery: z.boolean().default(true),
  acceptsOffers: z.boolean().default(true),
  decals: z.enum(['perfect', 'yellowed', 'unavailable']).default('perfect'),
  markAsSold: z.boolean().default(false),
})

const commitSchema = z.object({
  ownerId: z.string().uuid('Elige la cuenta destinataria'),
  options: optionsSchema,
  categories: z.record(z.string(), z.string().uuid().nullable()).default({}),
})

/**
 * Lee el formulario multipart del importador: campos de texto y dos ficheros, `excel`
 * (obligatorio) y `zip` (imágenes). Límites propios, más altos que los de las fotos sueltas.
 */
async function readImportForm(req: FastifyRequest) {
  const fields: Record<string, string> = {}
  let excel: Buffer | null = null
  let zip: Buffer | null = null
  const tooBig = (what: string, max: number) =>
    new HttpError(
      413,
      'too_large',
      `${what} supera el tamaño máximo (${Math.round(max / 1024 / 1024)} MB).`,
    )

  for await (const part of req.parts({
    limits: { fileSize: MAX_ZIP_BYTES, files: 2, fields: 5 },
  })) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(part.value)
      continue
    }
    let buf: Buffer
    try {
      buf = await part.toBuffer()
    } catch {
      throw tooBig(part.fieldname === 'excel' ? 'El Excel' : 'El ZIP', MAX_ZIP_BYTES)
    }
    if (part.fieldname === 'excel') {
      if (buf.length > MAX_EXCEL_BYTES) throw tooBig('El Excel', MAX_EXCEL_BYTES)
      excel = buf
    } else if (part.fieldname === 'zip') {
      zip = buf
    }
  }
  if (!excel) throw badRequest('Falta el Excel.', 'excel_required')
  const sheet = await readWorkbook(excel)
  const images = zip ? readImagesZip(zip) : new Map<string, Buffer>()
  return { fields, sheet, images }
}

const parseJsonField = (raw: string | undefined) => {
  try {
    return raw ? (JSON.parse(raw) as unknown) : {}
  } catch {
    throw badRequest('Datos del formulario no válidos.')
  }
}

/** Importador masivo de maquetas desde Excel (+ ZIP de imágenes). Solo administradores. */
export const importRoutes: FastifyPluginAsync = async (app) => {
  const { db, config } = app.deps

  // Paso 1: vista previa. No escribe nada.
  app.post('/admin/import/preview', async (req) => {
    requireAdmin(req)
    const { fields, sheet, images } = await readImportForm(req)
    const { ownerId } = parse(
      z.object({ ownerId: z.string().uuid('Elige la cuenta destinataria') }),
      fields,
    )
    const analysis = await analyzeImport(db, ownerId, sheet, images)
    return ok({ rows: analysis.rows, summary: { ...analysis.summary, images: images.size } })
  })

  // Paso 2: importar. Se reenvían los mismos ficheros y lo elegido en la vista previa.
  app.post('/admin/import/commit', async (req) => {
    requireAdmin(req)
    const { fields, sheet, images } = await readImportForm(req)
    const input = parse(commitSchema, parseJsonField(fields.payload))
    return ok(await runImport({ db, uploadsDir: config.UPLOADS_DIR }, sheet, images, input))
  })
}
