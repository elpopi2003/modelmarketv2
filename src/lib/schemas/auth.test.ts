import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from './auth'

describe('loginSchema', () => {
  it('acepta credenciales válidas', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it('rechaza email inválido y contraseña vacía', () => {
    expect(loginSchema.safeParse({ email: 'no-email', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('acepta registro válido', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      confirmPassword: '12345678',
    })
    expect(result.success).toBe(true)
  })

  it('exige mínimo 8 caracteres de contraseña', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('exige que las contraseñas coincidan', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      password: '12345678',
      confirmPassword: '87654321',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('confirmPassword')
    }
  })
})
