import { z } from 'zod'

/** Convierte '' / null / undefined a undefined para que z.number lo trate como obligatorio. */
const requiredNumber = (label: string, invalid: string) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ required_error: label, invalid_type_error: invalid })
      .min(0, 'No puede ser negativo')
      .max(1_000_000, 'Valor demasiado alto'),
  )

export const listingSchema = z
  .object({
    title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
    description: z
      .string()
      .trim()
      .min(10, 'Mínimo 10 caracteres')
      .max(2000, 'Máximo 2000 caracteres'),
    priceEuros: requiredNumber('El precio es obligatorio', 'Introduce un precio'),
    condition: z.enum(['new', 'like_new', 'used', 'for_parts'], {
      message: 'Elige un estado',
    }),
    scale: z.string().trim().min(1, 'La escala es obligatoria').max(20, 'Máximo 20 caracteres'),
    categoryId: z.string().uuid('Selecciona una categoría'),
    // uuid de una marca existente, o 'other' para crear una nueva.
    brandId: z.string().min(1, 'Selecciona una marca'),
    newBrand: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.brandId === 'other' && (!data.newBrand || data.newBrand.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newBrand'],
        message: 'Escribe el nombre de la marca (mín. 2)',
      })
    }
  })

export type ListingFormValues = z.infer<typeof listingSchema>
