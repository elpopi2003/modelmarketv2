import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { TEST_DB_URL, resetTestDb, testApp } from '../test/helpers'

const ORIGIN = 'http://localhost:5173'

describe.skipIf(!TEST_DB_URL)('API de autenticación', () => {
  let db: Db
  let app: FastifyInstance

  beforeAll(async () => {
    db = await resetTestDb()
    app = await testApp(db)
  })
  afterAll(async () => {
    await app?.close()
    await db?.destroy()
  })
  beforeEach(async () => {
    await db.deleteFrom('email_outbox').execute()
    await db.deleteFrom('users').execute()
  })

  // ── utilidades ─────────────────────────────────────────────────────────────
  const post = (url: string, payload: object = {}, cookie?: string) =>
    app.inject({
      method: 'POST',
      url: `/api${url}`,
      payload,
      headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    })
  const me = (cookie?: string) =>
    app.inject({ method: 'GET', url: '/api/auth/me', headers: cookie ? { cookie } : {} })

  const sessionCookie = (res: Awaited<ReturnType<typeof post>>) => {
    const c = res.cookies.find((x) => x.name === 'mm_session')
    return c ? `mm_session=${c.value}` : undefined
  }

  /** Último email en cola para `to` (y de un tipo, si se indica). */
  async function lastEmail(to: string, kind?: string) {
    let q = db.selectFrom('email_outbox').selectAll().where('to_email', '=', to)
    if (kind) q = q.where('kind', '=', kind)
    return q.orderBy('created_at', 'desc').limit(1).executeTakeFirst()
  }
  const tokenFrom = (html: string) => /token=([A-Za-z0-9_-]+)/.exec(html)?.[1] ?? ''

  async function registerAndVerify(email: string, password = 'contraseña-segura') {
    await post('/auth/register', { email, password })
    const mail = await lastEmail(email, 'verify_email')
    await post('/auth/verify-email', { token: tokenFrom(mail!.html) })
  }

  async function loginCookie(email: string, password = 'contraseña-segura') {
    const res = await post('/auth/login', { email, password })
    expect(res.statusCode).toBe(200)
    return sessionCookie(res)!
  }

  // ── alta y verificación ────────────────────────────────────────────────────
  it('alta: crea usuario sin verificar, perfil, rol user y encola el email de verificación', async () => {
    const res = await post('/auth/register', {
      email: '  Ana@Test.Local ',
      password: 'contraseña-segura',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, data: { needsConfirmation: true }, error: null })

    const user = await db.selectFrom('users').selectAll().executeTakeFirstOrThrow()
    expect(user.email).toBe('ana@test.local')
    expect(user.email_verified_at).toBeNull()
    expect(user.password_hash).toMatch(/^\$argon2id\$/)

    const profile = await db.selectFrom('profiles').selectAll().executeTakeFirstOrThrow()
    expect(profile.display_name).toBe('ana')
    const roles = await db.selectFrom('user_roles').select('role').execute()
    expect(roles).toEqual([{ role: 'user' }])

    const mail = await lastEmail('ana@test.local', 'verify_email')
    expect(mail?.subject).toBe('Confirma tu email en ModelMarket')
    expect(mail?.html).toContain('http://localhost:5173/auth/verificar?token=')
    expect(mail?.text).toContain('Confirmar mi email: http://localhost:5173/auth/verificar?token=')
  })

  it('valida los datos con mensajes listos para mostrar', async () => {
    const res = await post('/auth/register', {
      email: 'no-es-email',
      password: 'contraseña-segura',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toBe('Introduce un email válido')
    const short = await post('/auth/register', { email: 'a@test.local', password: 'corta' })
    expect(short.json().error.message).toBe('Mínimo 8 caracteres')
  })

  it('no deja entrar sin verificar el email; tras verificar, sí', async () => {
    await post('/auth/register', { email: 'b@test.local', password: 'contraseña-segura' })
    const before = await post('/auth/login', {
      email: 'b@test.local',
      password: 'contraseña-segura',
    })
    expect(before.statusCode).toBe(403)
    expect(before.json().error.code).toBe('email_not_confirmed')

    const mail = await lastEmail('b@test.local', 'verify_email')
    const verify = await post('/auth/verify-email', { token: tokenFrom(mail!.html) })
    expect(verify.statusCode).toBe(200)
    // Verificar no inicia sesión.
    expect(sessionCookie(verify)).toBeUndefined()

    const after = await post('/auth/login', {
      email: 'B@test.local',
      password: 'contraseña-segura',
    })
    expect(after.statusCode).toBe(200)
    expect(after.json().data).toMatchObject({
      email: 'b@test.local',
      emailVerified: true,
      isAdmin: false,
    })
  })

  it('un enlace de verificación solo sirve una vez', async () => {
    await post('/auth/register', { email: 'c@test.local', password: 'contraseña-segura' })
    const token = tokenFrom((await lastEmail('c@test.local'))!.html)
    expect((await post('/auth/verify-email', { token })).statusCode).toBe(200)
    const again = await post('/auth/verify-email', { token })
    expect(again.statusCode).toBe(400)
    expect(again.json().error.code).toBe('invalid_token')
  })

  it('registrarse con un email ya verificado responde igual, avisa al dueño y no cambia la contraseña', async () => {
    await registerAndVerify('d@test.local')
    const res = await post('/auth/register', { email: 'd@test.local', password: 'otra-contraseña' })
    expect(res.json()).toEqual({ ok: true, data: { needsConfirmation: true }, error: null })
    expect((await lastEmail('d@test.local'))?.kind).toBe('already_registered')
    expect(
      (await post('/auth/login', { email: 'd@test.local', password: 'otra-contraseña' }))
        .statusCode,
    ).toBe(401)
    expect(
      (await post('/auth/login', { email: 'd@test.local', password: 'contraseña-segura' }))
        .statusCode,
    ).toBe(200)
  })

  it('una nueva alta sin verificar invalida los enlaces anteriores', async () => {
    await post('/auth/register', { email: 'e@test.local', password: 'contraseña-uno' })
    const first = tokenFrom((await lastEmail('e@test.local'))!.html)
    await post('/auth/register', { email: 'e@test.local', password: 'contraseña-dos' })
    expect((await post('/auth/verify-email', { token: first })).statusCode).toBe(400)
  })

  // ── login ──────────────────────────────────────────────────────────────────
  it('credenciales erróneas y email inexistente dan exactamente la misma respuesta', async () => {
    await registerAndVerify('f@test.local')
    const wrong = await post('/auth/login', { email: 'f@test.local', password: 'mala-contraseña' })
    const missing = await post('/auth/login', {
      email: 'nadie@test.local',
      password: 'mala-contraseña',
    })
    expect(wrong.statusCode).toBe(401)
    expect(missing.statusCode).toBe(401)
    expect(wrong.json()).toEqual(missing.json())
  })

  it('la cookie de sesión es httpOnly y SameSite=Lax, y /me devuelve al usuario', async () => {
    await registerAndVerify('g@test.local')
    const res = await post('/auth/login', { email: 'g@test.local', password: 'contraseña-segura' })
    const c = res.cookies.find((x) => x.name === 'mm_session')!
    expect(c.httpOnly).toBe(true)
    expect(c.sameSite).toBe('Lax')
    expect(c.path).toBe('/')

    const meRes = await me(sessionCookie(res))
    expect(meRes.json().data).toMatchObject({ email: 'g@test.local', roles: ['user'] })
    expect((await me()).json()).toEqual({ ok: true, data: null, error: null })
  })

  it('acepta contraseñas bcrypt migradas de Supabase y las recifra con argon2id', async () => {
    const id = randomUUID()
    await db
      .insertInto('users')
      .values({
        id,
        email: 'migrado@test.local',
        password_hash: await bcrypt.hash('clave-de-antes', 10),
        email_verified_at: new Date(),
        last_login_at: null,
      })
      .execute()
    await loginCookie('migrado@test.local', 'clave-de-antes')
    const u = await db
      .selectFrom('users')
      .select('password_hash')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(u.password_hash).toMatch(/^\$argon2id\$/)
    await loginCookie('migrado@test.local', 'clave-de-antes')
  })

  it('logout cierra la sesión', async () => {
    await registerAndVerify('h@test.local')
    const cookie = await loginCookie('h@test.local')
    expect((await post('/auth/logout', {}, cookie)).statusCode).toBe(200)
    expect((await me(cookie)).json().data).toBeNull()
  })

  // ── suspensión ─────────────────────────────────────────────────────────────
  it('una suspensión echa al usuario de sus sesiones abiertas y le impide entrar', async () => {
    await registerAndVerify('i@test.local')
    const cookie = await loginCookie('i@test.local')
    const { id } = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', 'i@test.local')
      .executeTakeFirstOrThrow()
    await db
      .insertInto('user_suspensions')
      .values({ user_id: id, reason: 'spam', suspended_by: null })
      .execute()

    expect((await me(cookie)).json().data).toBeNull()
    const login = await post('/auth/login', {
      email: 'i@test.local',
      password: 'contraseña-segura',
    })
    expect(login.statusCode).toBe(403)
    expect(login.json().error.code).toBe('suspended')
  })

  // ── recuperación y cambio de contraseña ───────────────────────────────────
  it('recuperar contraseña con un email inexistente responde igual y no envía nada', async () => {
    const res = await post('/auth/forgot-password', { email: 'nadie@test.local' })
    expect(res.json()).toEqual({ ok: true, data: { sent: true }, error: null })
    expect(await db.selectFrom('email_outbox').selectAll().execute()).toHaveLength(0)
  })

  it('restablecer: cambia la contraseña, cierra las sesiones antiguas e inicia sesión', async () => {
    await registerAndVerify('j@test.local')
    const oldCookie = await loginCookie('j@test.local')

    await post('/auth/forgot-password', { email: 'j@test.local' })
    const mail = await lastEmail('j@test.local', 'reset_password')
    expect(mail?.html).toContain('/auth/restablecer?token=')

    const res = await post('/auth/reset-password', {
      token: tokenFrom(mail!.html),
      password: 'nueva-contraseña',
    })
    expect(res.json().data).toEqual({ loggedIn: true })
    expect((await me(sessionCookie(res))).json().data?.email).toBe('j@test.local')
    expect((await me(oldCookie)).json().data).toBeNull()
    expect(
      (await post('/auth/login', { email: 'j@test.local', password: 'contraseña-segura' }))
        .statusCode,
    ).toBe(401)
    await loginCookie('j@test.local', 'nueva-contraseña')
  })

  it('cambiar contraseña exige sesión, conserva la actual, cierra las demás y avisa por email', async () => {
    expect((await post('/auth/change-password', { password: 'nueva-contraseña' })).statusCode).toBe(
      401,
    )

    await registerAndVerify('k@test.local')
    const current = await loginCookie('k@test.local')
    const other = await loginCookie('k@test.local')

    const res = await post('/auth/change-password', { password: 'nueva-contraseña' }, current)
    expect(res.statusCode).toBe(200)
    expect((await me(current)).json().data?.email).toBe('k@test.local')
    expect((await me(other)).json().data).toBeNull()
    expect((await lastEmail('k@test.local'))?.kind).toBe('password_changed')
    await loginCookie('k@test.local', 'nueva-contraseña')
  })

  // ── CSRF ───────────────────────────────────────────────────────────────────
  it('rechaza peticiones que modifican datos desde otro origen', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'x@test.local', password: 'lo-que-sea' },
      headers: { origin: 'https://web-maliciosa.example' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.message).toBe('Origen no permitido.')
  })
})
