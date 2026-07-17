import { z } from 'zod'

export const requestSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().min(10, 'Mínimo 10 caracteres').max(2000, 'Máximo 2000 caracteres'),
  maxPriceEuros: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({
        required_error: 'El presupuesto es obligatorio',
        invalid_type_error: 'Introduce un presupuesto',
      })
      .min(0, 'No puede ser negativo')
      .max(1_000_000, 'Presupuesto demasiado alto'),
  ),
  scale: z.string().trim().min(1, 'La escala es obligatoria').max(20, 'Máximo 20 caracteres'),
  categoryId: z.string().uuid('Selecciona una categoría'),
  brandId: z.string().min(1, 'Selecciona una marca'),
  newBrand: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  acceptedConditions: z
    .array(z.enum(['sealed', 'opened', 'started']))
    .min(1, 'Marca al menos un estado que aceptes'),
  decalsRequirement: z.enum(['any', 'perfect', 'yellowed', 'unavailable'], {
    message: 'Elige el requisito de calcas',
  }),
  urgency: z.enum(['no_rush', 'normal', 'urgent'], {
    message: 'Elige la urgencia',
  }),
})

export type RequestFormValues = z.infer<typeof requestSchema>
