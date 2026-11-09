import type { ColumnType, Insertable, Selectable, Updateable } from 'kysely'

/**
 * Tipos de las tablas de MariaDB para Kysely.
 *
 * Se mantienen a mano junto a las migraciones (`server/db/migrations`): cada migración que
 * cambia una tabla actualiza aquí su interfaz en el mismo commit.
 */

/** Columna con valor por defecto en la base de datos: opcional al insertar. */
type Defaulted<T> = ColumnType<T, T | undefined, T>
/** Fecha gestionada por MariaDB (DEFAULT / ON UPDATE): no se escribe desde la app. */
type AutoDate = ColumnType<Date, never, never>

export type AppRole = 'admin' | 'user'
export type AuthTokenPurpose = 'verify_email' | 'reset_password'

export interface UsersTable {
  id: string
  email: string
  password_hash: string | null
  email_verified_at: Date | null
  last_login_at: Date | null
  created_at: AutoDate
  updated_at: AutoDate
}

export interface SessionsTable {
  /** SHA-256 (hex) del token de la cookie. */
  id: string
  user_id: string
  expires_at: Date
  last_seen_at: Defaulted<Date>
  ip: string | null
  user_agent: string | null
  created_at: AutoDate
}

export interface AuthTokensTable {
  token_hash: string
  user_id: string
  purpose: AuthTokenPurpose
  expires_at: Date
  used_at: Date | null
  created_at: AutoDate
}

export interface ProfilesTable {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  notify_email: Defaulted<boolean>
  notify_push: Defaulted<boolean>
  created_at: AutoDate
  updated_at: AutoDate
}

export interface UserRolesTable {
  id: string
  user_id: string
  role: Defaulted<AppRole>
  created_at: AutoDate
}

export interface UserSuspensionsTable {
  user_id: string
  reason: string
  suspended_at: Defaulted<Date>
  suspended_by: string | null
}

export interface Database {
  users: UsersTable
  sessions: SessionsTable
  auth_tokens: AuthTokensTable
  profiles: ProfilesTable
  user_roles: UserRolesTable
  user_suspensions: UserSuspensionsTable
}

export type User = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type Profile = Selectable<ProfilesTable>
export type ProfileUpdate = Updateable<ProfilesTable>
export type Session = Selectable<SessionsTable>
