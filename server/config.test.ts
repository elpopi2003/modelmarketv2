import { describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('aplica valores por defecto y convierte el puerto a número', () => {
    const c = loadConfig({ DATABASE_URL: 'mysql://u:p@127.0.0.1:3306/db', PORT: '4000' })
    expect(c.PORT).toBe(4000)
    expect(c.NODE_ENV).toBe('development')
    expect(c.STATIC_DIR).toBe('')
  })

  it('falla al arrancar si falta DATABASE_URL, indicando el campo', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })

  it('rechaza una URL que no sea de MySQL/MariaDB', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x' })).toThrow(/DATABASE_URL/)
  })
})
