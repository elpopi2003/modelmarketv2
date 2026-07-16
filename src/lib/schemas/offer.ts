import { z } from 'zod'

export const offerSchema = z.object({
  amountEuros: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({
        required_error: 'Indica tu oferta',
        invalid_type_error: 'Introduce un importe',
      })
      .min(0, 'No puede ser negativo')
      .max(1_000_000, 'Importe demasiado alto'),
  ),
  message: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional(),
})

export type OfferFormValues = z.infer<typeof offerSchema>
