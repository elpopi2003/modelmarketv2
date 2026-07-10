import { z } from 'zod'

export const listingSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  priceEuros: z.coerce
    .number({ invalid_type_error: 'Introduce un precio' })
    .min(0, 'No puede ser negativo')
    .max(1_000_000, 'Precio demasiado alto'),
  condition: z.enum(['new', 'like_new', 'used', 'for_parts'], {
    message: 'Elige un estado',
  }),
  scale: z.string().trim().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  brandId: z.string().uuid().optional().or(z.literal('')),
})

export type ListingFormValues = z.infer<typeof listingSchema>
