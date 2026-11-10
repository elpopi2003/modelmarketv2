import { z } from 'zod'

/**
 * Validación de lo que llega a la API de contenido. Los límites coinciden con los
 * formularios del frontend (`src/lib/schemas/*`), y los mensajes están redactados para
 * mostrarse al usuario tal cual.
 */
const title = z
  .string({ required_error: 'El título es obligatorio' })
  .trim()
  .min(3, 'El título necesita al menos 3 caracteres')
  .max(120, 'El título admite como máximo 120 caracteres')
const description = z.string().trim().max(2000, 'La descripción admite como máximo 2000 caracteres')
const cents = z
  .number({ invalid_type_error: 'El precio no es válido' })
  .int('El precio no es válido')
  .min(0, 'El precio no puede ser negativo')
  .max(100_000_000, 'El precio es demasiado alto')
const scale = z.string().trim().max(20, 'La escala admite como máximo 20 caracteres')
const uuid = (what: string) => z.string().uuid(`${what} no es válida`)
const photos = z
  .array(z.string().max(500), { invalid_type_error: 'Las fotos no son válidas' })
  .max(50, 'Demasiadas fotos')

export const conditionEnum = z.enum(['sealed', 'opened', 'started'])

export const listingCreateSchema = z.object({
  title,
  description: description.nullish(),
  price_cents: cents,
  condition: conditionEnum,
  decals: z.enum(['perfect', 'yellowed', 'unavailable']),
  scale: scale.nullish(),
  category_id: uuid('La categoría').nullish(),
  brand_id: uuid('La marca').nullish(),
  shipping_inpost: z.boolean().default(false),
  hand_delivery: z.boolean().default(false),
  accepts_offers: z.boolean().default(true),
  photos: photos.min(1, 'Añade al menos una foto'),
})

export const listingUpdateSchema = listingCreateSchema
  .partial()
  .extend({ status: z.enum(['draft', 'active', 'reserved', 'sold', 'archived']).optional() })
  .strict('Campo no permitido')

export const listingFiltersSchema = z.object({
  category: z.string().uuid().optional(),
  brand: z.string().uuid().optional(),
  condition: conditionEnum.optional(),
  q: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['recent', 'price_asc', 'price_desc']).default('recent'),
})

export const requestCreateSchema = z.object({
  title,
  description: description.nullish(),
  max_price_cents: cents.nullish(),
  scale: scale.nullish(),
  category_id: uuid('La categoría').nullish(),
  brand_id: uuid('La marca').nullish(),
  accepted_conditions: z
    .array(conditionEnum)
    .min(1, 'Marca al menos un estado que aceptes')
    .default(['sealed', 'opened', 'started']),
  decals_requirement: z.enum(['any', 'perfect', 'yellowed', 'unavailable']).default('any'),
  urgency: z.enum(['no_rush', 'normal', 'urgent']).default('no_rush'),
  photos: photos.default([]),
})

export const requestUpdateSchema = requestCreateSchema
  .partial()
  .extend({ status: z.enum(['open', 'fulfilled', 'closed']).optional() })
  .strict('Campo no permitido')

export const requestFiltersSchema = z.object({
  category: z.string().uuid().optional(),
  brand: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['recent', 'budget_desc', 'budget_asc']).default('recent'),
})

export const profileUpdateSchema = z
  .object({
    display_name: z.string().trim().max(60, 'Máximo 60 caracteres').nullish(),
    username: z
      .string()
      .trim()
      .max(30, 'Máximo 30 caracteres')
      .regex(/^[a-zA-Z0-9_]*$/, 'Solo letras, números y guion bajo')
      .nullish(),
    location: z.string().trim().max(100, 'Máximo 100 caracteres').nullish(),
    bio: z.string().trim().max(500, 'Máximo 500 caracteres').nullish(),
    notify_email: z.boolean().optional(),
    notify_push: z.boolean().optional(),
    avatar_url: z.string().max(500).nullish(),
  })
  .strict('Campo no permitido')

export const brandNameSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la marca es obligatorio' })
    .trim()
    .min(1, 'El nombre de la marca es obligatorio')
    .max(60, 'Máximo 60 caracteres'),
})

/** Lista de IDs en la query string: `?ids=a,b,c` (máximo 100). */
export const idsQuerySchema = z.object({
  ids: z
    .string()
    .default('')
    .transform((s) => [...new Set(s.split(',').filter(Boolean))])
    .pipe(z.array(z.string().uuid('ID no válido')).max(100, 'Demasiados IDs')),
})
