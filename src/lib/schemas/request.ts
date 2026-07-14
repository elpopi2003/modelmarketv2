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
  brandId: z.string().uuid('Selecciona una marca'),
})

export type RequestFormValues = z.infer<typeof requestSchema>
