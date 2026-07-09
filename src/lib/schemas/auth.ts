import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Introduce un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    email: z.string().min(1, 'El email es obligatorio').email('Introduce un email válido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type RegisterValues = z.infer<typeof registerSchema>
