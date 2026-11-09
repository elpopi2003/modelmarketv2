import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../client'
import { TEST_DB_URL, resetTestDb } from '../../test/helpers'

// Comprueba en MariaDB real las garantías que el esquema da por sí mismo (las que antes
// daban las constraints de Postgres): unicidad, cascadas, tipos y valores por defecto.
describe.skipIf(!TEST_DB_URL)('esquema: usuarios, perfiles, roles y suspensiones', () => {
  let db: Db
  beforeAll(async () => {
    db = await resetTestDb()
  })
  afterAll(() => db?.destroy())
  beforeEach(async () => {
    await db.deleteFrom('users').execute()
  })

  async function newUser(email = `u${Date.now()}${Math.random()}@test.local`) {
    const id = randomUUID()
    await db
      .insertInto('users')
      .values({ id, email, password_hash: null, email_verified_at: null, last_login_at: null })
      .execute()
    return id
  }

  it('el email es único sin distinguir mayúsculas', async () => {
    await newUser('ana@test.local')
    await expect(newUser('ANA@test.local')).rejects.toThrow(/Duplicate entry/)
  })

  it('el UUID se lee como texto y los booleanos como true/false con sus valores por defecto', async () => {
    const id = await newUser()
    await db
      .insertInto('profiles')
      .values({
        id,
        username: null,
        display_name: 'Ana',
        avatar_url: null,
        bio: null,
        location: null,
      })
      .execute()
    const p = await db
      .selectFrom('profiles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(p.id).toBe(id)
    expect(p.notify_email).toBe(true)
    expect(p.notify_push).toBe(false)
    expect(p.created_at).toBeInstanceOf(Date)
  })

  it('borrar un usuario borra en cascada perfil, roles, sesiones, tokens y suspensión', async () => {
    const id = await newUser()
    const admin = await newUser()
    await db
      .insertInto('profiles')
      .values({
        id,
        username: null,
        display_name: null,
        avatar_url: null,
        bio: null,
        location: null,
      })
      .execute()
    await db.insertInto('user_roles').values({ id: randomUUID(), user_id: id }).execute()
    await db
      .insertInto('sessions')
      .values({
        id: 'a'.repeat(64),
        user_id: id,
        expires_at: new Date(Date.now() + 3600e3),
        ip: null,
        user_agent: null,
      })
      .execute()
    await db
      .insertInto('auth_tokens')
      .values({
        token_hash: 'b'.repeat(64),
        user_id: id,
        purpose: 'verify_email',
        expires_at: new Date(),
        used_at: null,
      })
      .execute()
    await db
      .insertInto('user_suspensions')
      .values({ user_id: id, reason: 'spam', suspended_by: admin })
      .execute()

    await db.deleteFrom('users').where('id', '=', id).execute()

    for (const [table, col] of [
      ['profiles', 'id'],
      ['user_roles', 'user_id'],
      ['sessions', 'user_id'],
      ['auth_tokens', 'user_id'],
      ['user_suspensions', 'user_id'],
    ] as const) {
      const rows = await db.selectFrom(table).select(col).where(col, '=', id).execute()
      expect(rows, table).toHaveLength(0)
    }
  })

  it('borrar al admin que suspendió no borra la suspensión: deja suspended_by a NULL', async () => {
    const id = await newUser()
    const admin = await newUser()
    await db
      .insertInto('user_suspensions')
      .values({ user_id: id, reason: 'spam', suspended_by: admin })
      .execute()
    await db.deleteFrom('users').where('id', '=', admin).execute()
    const s = await db
      .selectFrom('user_suspensions')
      .selectAll()
      .where('user_id', '=', id)
      .executeTakeFirstOrThrow()
    expect(s.suspended_by).toBeNull()
  })

  it('un usuario no puede tener el mismo rol dos veces', async () => {
    const id = await newUser()
    await db
      .insertInto('user_roles')
      .values({ id: randomUUID(), user_id: id, role: 'admin' })
      .execute()
    await expect(
      db
        .insertInto('user_roles')
        .values({ id: randomUUID(), user_id: id, role: 'admin' })
        .execute(),
    ).rejects.toThrow(/Duplicate entry/)
  })
})
