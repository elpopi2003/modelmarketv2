import { z } from 'zod'

export const profileSchema = z.object({
  display_name: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  username: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]*$/, 'Solo letras, números y guion bajo')
    .optional(),
  bio: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>
