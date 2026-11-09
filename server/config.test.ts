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

  it('compone la URL desde DB_* codificando contraseñas con símbolos de Plesk', () => {
    const c = loadConfig({
      DB_HOST: 'localhost',
      DB_USER: 'mm_staging',
      DB_PASSWORD: 'a@b#c/d:e?f%',
      DB_NAME: 'modelmarket_staging',
    })
    expect(c.DATABASE_URL).toBe(
      'mysql://mm_staging:a%40b%23c%2Fd%3Ae%3Ff%25@localhost:3306/modelmarket_staging',
    )
    // mysql2 decodifica usuario y contraseña con decodeURIComponent: vuelve la original.
    const u = new URL(c.DATABASE_URL)
    expect(decodeURIComponent(u.password)).toBe('a@b#c/d:e?f%')
  })

  it('DATABASE_URL tiene prioridad sobre DB_*', () => {
    const c = loadConfig({
      DATABASE_URL: 'mysql://x:y@h:3306/d',
      DB_HOST: 'otro',
      DB_USER: 'u',
      DB_NAME: 'n',
    })
    expect(c.DATABASE_URL).toBe('mysql://x:y@h:3306/d')
  })
})
