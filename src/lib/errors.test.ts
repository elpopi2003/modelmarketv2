import { describe, expect, it } from 'vitest'
import { AppError, getErrorMessage, handleSupabaseError } from './errors'

describe('getErrorMessage', () => {
  it('traduce códigos PostgREST/Postgres conocidos', () => {
    const err = { message: 'duplicate key', code: '23505', details: '', hint: '' }
    expect(getErrorMessage(err)).toMatch(/ya existe/i)
  })

  it('usa el mensaje del error para códigos no mapeados', () => {
    const err = { message: 'boom', code: 'XXXXX', details: '', hint: '' }
    expect(getErrorMessage(err)).toBe('boom')
  })

  it('cae al fallback para valores desconocidos', () => {
    expect(getErrorMessage(null)).toMatch(/algo salió mal/i)
    expect(getErrorMessage(42, 'ups')).toBe('ups')
  })

  it('respeta el mensaje de un AppError', () => {
    expect(getErrorMessage(new AppError('sin permisos'))).toBe('sin permisos')
  })
})

describe('handleSupabaseError', () => {
  it('relanza como AppError conservando el código', () => {
    const err = { message: 'denied', code: '42501', details: '', hint: '' }
    try {
      handleSupabaseError(err)
      expect.unreachable('debería lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).code).toBe('42501')
      expect((e as AppError).message).toMatch(/no tienes permisos/i)
    }
  })
})
