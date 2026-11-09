import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  email: z.string().trim().email('Introduce un email válido').max(120, 'Máximo 120 caracteres'),
  subject: z.string().trim().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  message: z
    .string()
    .trim()
    .min(10, 'Cuéntanos algo más (mínimo 10)')
    .max(2000, 'Máximo 2000 caracteres'),
})

export type ContactFormValues = z.infer<typeof contactSchema>
