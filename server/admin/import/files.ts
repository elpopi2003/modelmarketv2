import ExcelJS from 'exceljs'
import { unzipSync } from 'fflate'
import { badRequest } from '../../http/reply'

/**
 * Lectura de los ficheros del importador: el Excel de la colección y el ZIP de imágenes.
 * Ambos llegan de un administrador, pero se tratan como datos no fiables: tamaños
 * acotados, solo imágenes del ZIP, sin rutas, y nada se ejecuta.
 */

export const MAX_EXCEL_BYTES = 10 * 1024 * 1024
export const MAX_ZIP_BYTES = 300 * 1024 * 1024
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_UNZIPPED_TOTAL = 600 * 1024 * 1024
export const MAX_ROWS = 2000

/** "Tamiya-24229", " tamiya 24229 " y "TAMIYA_24229" son la misma clave. */
export const normKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Texto de una celda de exceljs (texto enriquecido, hipervínculo, fórmula, fecha…). */
function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('richText' in v)
      return (
        v.richText
          .map((t) => t.text)
          .join('')
          .trim() || null
      )
    if ('text' in v && typeof v.text === 'string') return v.text.trim() || null
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('hyperlink' in v && typeof v.hyperlink === 'string') return v.hyperlink
  }
  return null
}

function cellNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = cellText(v)
  if (!t) return null
  // "26,44 €", "26.44", "1.234,50" → número
  const cleaned = t.replace(/[€\s]/g, '')
  const normalized = /,\d{1,2}$/.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Cabeceras admitidas (normalizadas con normKey) → campo interno. */
const HEADERS: Record<string, string> = {
  marca: 'brand',
  brand: 'brand',
  referencia: 'reference',
  ref: 'reference',
  reference: 'reference',
  nombre: 'name',
  name: 'name',
  titulo: 'name',
  escala: 'scale',
  scale: 'scale',
  categoria: 'category',
  category: 'category',
  ano: 'year',
  year: 'year',
  estanteria: 'shelf',
  estadofisico: 'condition',
  estado: 'condition',
  condition: 'condition',
  cantidad: 'quantity',
  quantity: 'quantity',
  precio: 'price',
  price: 'price',
  preciomedio: 'avgPrice',
  notas: 'notes',
  notes: 'notes',
  ficha: 'link',
  url: 'link',
  enlace: 'link',
}

export interface SheetRow {
  /** Número de fila en el Excel (la cabecera es la 1). */
  row: number
  brand: string | null
  reference: string | null
  name: string | null
  scale: string | null
  category: string | null
  year: string | null
  shelf: string | null
  condition: string | null
  quantity: number | null
  price: number | null
  notes: string | null
  link: string | null
}

export async function readWorkbook(buffer: Buffer): Promise<SheetRow[]> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw badRequest(
      'No se ha podido leer el Excel. Guárdalo como .xlsx y vuelve a intentarlo.',
      'invalid_excel',
    )
  }
  const ws = wb.worksheets[0]
  if (!ws) throw badRequest('El Excel no tiene ninguna hoja.', 'invalid_excel')

  const columns = new Map<string, number>()
  ws.getRow(1).eachCell((cell, col) => {
    const field = HEADERS[normKey(cellText(cell.value) ?? '')]
    if (field && !columns.has(field)) columns.set(field, col)
  })
  const missing = ['brand', 'name'].filter((f) => !columns.has(f))
  if (!columns.has('price') && !columns.has('avgPrice')) missing.push('price')
  if (missing.length) {
    const names: Record<string, string> = {
      brand: 'Marca',
      name: 'Nombre',
      price: 'Precio o Precio medio',
    }
    throw badRequest(
      `Faltan columnas obligatorias: ${missing.map((m) => names[m]).join(', ')}. La primera fila debe ser la cabecera.`,
      'missing_columns',
    )
  }

  const rows: SheetRow[] = []
  ws.eachRow((r, n) => {
    if (n === 1) return
    const get = (f: string) => {
      const c = columns.get(f)
      return c ? r.getCell(c).value : null
    }
    const row: SheetRow = {
      row: n,
      brand: cellText(get('brand')),
      reference: cellText(get('reference')),
      name: cellText(get('name')),
      scale: cellText(get('scale')),
      category: cellText(get('category')),
      year: cellText(get('year')),
      shelf: cellText(get('shelf')),
      condition: cellText(get('condition')),
      quantity: cellNumber(get('quantity')),
      // "Precio" manda; si no hay, "Precio medio".
      price: cellNumber(get('price')) ?? cellNumber(get('avgPrice')),
      notes: cellText(get('notes')),
      link: cellText(get('link')),
    }
    if (row.brand || row.name) rows.push(row)
  })
  if (rows.length === 0) throw badRequest('El Excel no tiene filas de maquetas.', 'empty_excel')
  if (rows.length > MAX_ROWS)
    throw badRequest(`Como mucho ${MAX_ROWS} filas por importación.`, 'too_many_rows')
  return rows
}

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i

/**
 * Imágenes del ZIP indexadas por su nombre normalizado (sin extensión ni carpetas).
 * Se comprueba el tamaño declarado ANTES de descomprimir cada entrada, para que un ZIP
 * diseñado para inflarse (zip bomb) no llegue a ocupar memoria.
 */
export function readImagesZip(buffer: Buffer): Map<string, Buffer> {
  let total = 0
  let tooBig = false
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => {
        const base = f.name.split('/').pop() ?? ''
        if (!IMAGE_EXT.test(base) || base.startsWith('.') || f.name.startsWith('__MACOSX/'))
          return false
        if (f.originalSize > MAX_IMAGE_BYTES) return false
        total += f.originalSize
        if (total > MAX_UNZIPPED_TOTAL) {
          tooBig = true
          return false
        }
        return true
      },
    })
  } catch {
    throw badRequest('No se ha podido leer el ZIP de imágenes.', 'invalid_zip')
  }
  if (tooBig) throw badRequest('El ZIP descomprimido supera el tamaño permitido.', 'zip_too_big')

  const images = new Map<string, Buffer>()
  for (const [path, data] of Object.entries(files)) {
    const key = normKey((path.split('/').pop() ?? '').replace(IMAGE_EXT, ''))
    if (key && !images.has(key)) images.set(key, Buffer.from(data))
  }
  return images
}
