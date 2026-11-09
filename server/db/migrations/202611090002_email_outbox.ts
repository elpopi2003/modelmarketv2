import { sql, type Kysely } from 'kysely'

/**
 * Cola de emails salientes.
 *
 * Las acciones (alta, suspensión, mensaje nuevo…) no envían el correo en el momento: lo
 * dejan aquí, dentro de su misma transacción, y un proceso en segundo plano lo entrega por
 * el Postfix local con reintentos. Así un fallo del correo nunca hace fallar la acción del
 * usuario, y un correo no se pierde si el servidor se reinicia a mitad.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE email_outbox (
      id          UUID          NOT NULL PRIMARY KEY,
      to_email    VARCHAR(254)  NOT NULL,
      subject     VARCHAR(255)  NOT NULL,
      html        MEDIUMTEXT    NOT NULL,
      text        MEDIUMTEXT    NOT NULL,
      reply_to    VARCHAR(254)  NULL,
      -- Cabeceras extra (p. ej. List-Unsubscribe en las notificaciones).
      headers     JSON          NULL,
      -- Etiqueta para logs y estadísticas: 'verify_email', 'reset_password', ...
      kind        VARCHAR(50)   NOT NULL,
      status      ENUM('pending', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
      attempts    INT UNSIGNED  NOT NULL DEFAULT 0,
      last_error  TEXT          NULL,
      send_after  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      sent_at     DATETIME(3)   NULL,
      created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY email_outbox_pending_idx (status, send_after),
      CONSTRAINT email_outbox_headers_json CHECK (headers IS NULL OR JSON_VALID(headers))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS email_outbox`.execute(db)
}
