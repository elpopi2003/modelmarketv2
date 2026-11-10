import { readFileSync } from 'node:fs'
import pg from 'pg'

/**
 * Lectura de los datos de v2 (Supabase / Postgres) para migrarlos a MariaDB.
 *
 * Se lee todo de una vez en una transacción de solo lectura (instantánea coherente).
 * Los tipos son deliberadamente laxos: es una importación única y `import.ts` valida y
 * transforma cada fila.
 */
export type Row = Record<string, unknown>

export interface SourceData {
  users: Row[]
  profiles: Row[]
  user_roles: Row[]
  user_suspensions: Row[]
  categories: Row[]
  brands: Row[]
  listings: Row[]
  requests: Row[]
  favorites: Row[]
  conversations: Row[]
  messages: Row[]
  offers: Row[]
  notifications: Row[]
  reports: Row[]
  subscriptions: Row[]
}

const PUBLIC_TABLES = [
  'profiles',
  'user_roles',
  'user_suspensions',
  'categories',
  'brands',
  'listings',
  'requests',
  'favorites',
  'conversations',
  'messages',
  'offers',
  'notifications',
  'reports',
  'subscriptions',
] as const

/**
 * Conexión TLS verificada. `caFile`: el certificado raíz de Supabase (panel del proyecto →
 * Database → SSL Configuration → "Download certificate"). Sin él se usan las CA del sistema.
 */
function tlsOptions(caFile?: string): pg.ClientConfig['ssl'] {
  return caFile ? { ca: readFileSync(caFile, 'utf8') } : true
}

/**
 * `connectionString`: la del "Session pooler" de Supabase (IPv4), con la contraseña de la
 * base de datos.
 */
export async function readSupabase(connectionString: string, caFile?: string): Promise<SourceData> {
  const client = new pg.Client({ connectionString, ssl: tlsOptions(caFile) })
  try {
    await client.connect()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/certificate/i.test(msg)) {
      throw new Error(
        `No se pudo verificar el certificado de Supabase (${msg}). Descarga la CA en el panel ` +
          `del proyecto → Database → SSL Configuration y pasa su ruta en SUPABASE_CA_FILE.`,
      )
    }
    throw err
  }
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const users = (
      await client.query(
        `SELECT id, email, encrypted_password, email_confirmed_at, last_sign_in_at, created_at
           FROM auth.users ORDER BY created_at`,
      )
    ).rows
    const out = { users } as SourceData
    for (const t of PUBLIC_TABLES) {
      // Las columnas array de Postgres se piden como JSON para no depender del parser de arrays.
      const sql =
        t === 'listings'
          ? 'SELECT *, to_json(photos) AS photos_json FROM public.listings'
          : t === 'requests'
            ? 'SELECT *, to_json(photos) AS photos_json, to_json(accepted_conditions) AS conditions_json FROM public.requests'
            : `SELECT * FROM public.${t}`
      out[t] = (await client.query(sql)).rows
    }
    await client.query('COMMIT')
    return out
  } finally {
    await client.end()
  }
}

export function summarize(data: SourceData) {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]))
}
