import { z } from 'zod'

export const requestSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  /** Presupuesto máximo en euros (opcional). Se valida como número no negativo si se rellena. */
  maxPriceEuros: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Introduce un precio válido'),
  scale: z.string().trim().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  brandId: z.string().uuid().optional().or(z.literal('')),
})

export type RequestFormValues = z.infer<typeof requestSchema>
