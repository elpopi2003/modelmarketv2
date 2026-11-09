import { sql, type Kysely } from 'kysely'

/**
 * Usuarios, autenticación, perfiles, roles y suspensiones.
 *
 * Sustituye a `auth.users` de Supabase + `profiles`, `user_roles` y `user_suspensions`.
 * Los IDs son UUID nativos de MariaDB (16 bytes, se leen como texto) para conservar los
 * mismos IDs al migrar los datos actuales. Se generan en la aplicación (crypto.randomUUID).
 *
 * Reglas que antes imponía RLS y ahora impone la capa de políticas del servidor:
 *  - profiles: lectura pública SOLO de columnas públicas; cada uno edita el suyo.
 *  - user_roles: nadie los escribe desde la API salvo un admin; nunca en profiles.
 *  - user_suspensions: solo el propio usuario y los admins leen el motivo.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE users (
      id                UUID         NOT NULL PRIMARY KEY,
      email             VARCHAR(254) NOT NULL,
      -- argon2id (nuevas) o bcrypt (migradas de Supabase; se recifran en el primer login).
      password_hash     VARCHAR(255) NULL,
      email_verified_at DATETIME(3)  NULL,
      last_login_at     DATETIME(3)  NULL,
      created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      -- Siempre en minúsculas (lo garantiza la aplicación); único sin distinguir mayúsculas.
      UNIQUE KEY users_email_unique (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)

  // Sesiones: se guarda el SHA-256 del token, nunca el token. Si alguien lee la tabla no
  // puede suplantar a nadie. Borrar las filas de un usuario = cerrarle todas las sesiones.
  await sql`
    CREATE TABLE sessions (
      id           CHAR(64)     NOT NULL PRIMARY KEY,
      user_id      UUID         NOT NULL,
      expires_at   DATETIME(3)  NOT NULL,
      last_seen_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ip           VARCHAR(45)  NULL,
      user_agent   VARCHAR(255) NULL,
      created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY sessions_user_idx (user_id),
      KEY sessions_expires_idx (expires_at),
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)

  // Enlaces de un solo uso enviados por email (verificar cuenta, restablecer contraseña).
  // También se guarda solo el hash del token.
  await sql`
    CREATE TABLE auth_tokens (
      token_hash CHAR(64)    NOT NULL PRIMARY KEY,
      user_id    UUID        NOT NULL,
      purpose    ENUM('verify_email', 'reset_password') NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at    DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY auth_tokens_user_purpose_idx (user_id, purpose),
      CONSTRAINT auth_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)

  // Perfil: solo datos que el usuario decide mostrar. El email vive en users, no aquí.
  await sql`
    CREATE TABLE profiles (
      id           UUID         NOT NULL PRIMARY KEY,
      username     VARCHAR(50)  NULL,
      display_name VARCHAR(100) NULL,
      avatar_url   VARCHAR(500) NULL,
      bio          TEXT         NULL,
      location     VARCHAR(120) NULL,
      notify_email BOOLEAN      NOT NULL DEFAULT TRUE,
      notify_push  BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY profiles_username_unique (username),
      CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)

  await sql`
    CREATE TABLE user_roles (
      id         UUID        NOT NULL PRIMARY KEY,
      user_id    UUID        NOT NULL,
      role       ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY user_roles_user_role_unique (user_id, role),
      CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)

  // Tabla aparte y no columnas en profiles: el motivo es una nota de moderación sobre una
  // persona y nunca debe salir en las consultas públicas de perfiles.
  await sql`
    CREATE TABLE user_suspensions (
      user_id      UUID        NOT NULL PRIMARY KEY,
      reason       TEXT        NOT NULL,
      suspended_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      suspended_by UUID        NULL,
      CONSTRAINT user_suspensions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT user_suspensions_by_fk FOREIGN KEY (suspended_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of [
    'user_suspensions',
    'user_roles',
    'profiles',
    'auth_tokens',
    'sessions',
    'users',
  ]) {
    await sql`DROP TABLE IF EXISTS ${sql.table(t)}`.execute(db)
  }
}
