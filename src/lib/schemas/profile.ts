import { z } from 'zod'

export const profileSchema = z.object({
  display_name: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  username: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_]*$/, 'Solo letras, números y guion bajo')
    .optional(),
  location: z.string().trim().max(100, 'Máximo 100 caracteres').optional(),
  bio: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

/** Cambio de contraseña (Configuración). */
export const passwordSchema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres').max(200, 'Máximo 200 caracteres'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  })

export type PasswordFormValues = z.infer<typeof passwordSchema>
