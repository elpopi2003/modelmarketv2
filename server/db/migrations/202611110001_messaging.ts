import { sql, type Kysely } from 'kysely'

/**
 * Mensajería, ofertas y notificaciones.
 *
 * Mismo modelo que en Postgres. Lo que allí hacían triggers y funciones SECURITY DEFINER
 * (crear/reutilizar conversación, ofertas, avisos, contadores de no leídos) lo hace ahora
 * `server/messaging/*` dentro de transacciones, con tests.
 *
 * Igual que en v2, borrar un anuncio o una petición borra sus conversaciones y ofertas.
 */
const TABLE_OPTS = sql.raw('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci')

export async function up(db: Kysely<unknown>): Promise<void> {
  // Una conversación cuelga de un anuncio (comprador ↔ vendedor) o de una petición
  // (autor de la petición = buyer ↔ quien ofrece = seller). Única por par: los UNIQUE de
  // MariaDB ignoran los NULL, así que equivalen a los índices parciales de Postgres.
  await sql`
    CREATE TABLE conversations (
      id                UUID        NOT NULL PRIMARY KEY,
      listing_id        UUID        NULL,
      request_id        UUID        NULL,
      buyer_id          UUID        NOT NULL,
      seller_id         UUID        NOT NULL,
      -- Borrado "por mi lado": se oculta solo para ese participante.
      buyer_deleted_at  DATETIME(3) NULL,
      seller_deleted_at DATETIME(3) NULL,
      created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY conversations_listing_buyer_unique (listing_id, buyer_id),
      UNIQUE KEY conversations_request_seller_unique (request_id, seller_id),
      KEY conversations_buyer_idx (buyer_id, updated_at),
      KEY conversations_seller_idx (seller_id, updated_at),
      CONSTRAINT conversations_subject CHECK ((listing_id IS NULL) <> (request_id IS NULL)),
      CONSTRAINT conversations_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE,
      CONSTRAINT conversations_request_fk FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE CASCADE,
      CONSTRAINT conversations_buyer_fk FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT conversations_seller_fk FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}
  `.execute(db)

  await sql`
    CREATE TABLE messages (
      id              UUID        NOT NULL PRIMARY KEY,
      conversation_id UUID        NOT NULL,
      sender_id       UUID        NOT NULL,
      body            TEXT        NOT NULL,
      kind            ENUM('text', 'offer') NOT NULL DEFAULT 'text',
      read_at         DATETIME(3) NULL,
      created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY messages_conversation_idx (conversation_id, created_at),
      KEY messages_unread_idx (conversation_id, read_at),
      CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
      CONSTRAINT messages_sender_fk FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}
  `.execute(db)

  // pending_key: una sola oferta pendiente por persona y anuncio/petición. MariaDB no
  // tiene índices únicos parciales; la columna generada es NULL cuando la oferta ya no
  // está pendiente, y los NULL no chocan en un UNIQUE.
  await sql`
    CREATE TABLE offers (
      id              UUID         NOT NULL PRIMARY KEY,
      listing_id      UUID         NULL,
      request_id      UUID         NULL,
      from_user_id    UUID         NOT NULL,
      to_user_id      UUID         NOT NULL,
      conversation_id UUID         NULL,
      amount_cents    INT UNSIGNED NOT NULL,
      message         TEXT         NULL,
      status          ENUM('pending', 'accepted', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
      pending_key     VARCHAR(80)  AS (IF(status = 'pending', CONCAT(COALESCE(listing_id, request_id), ':', from_user_id), NULL)) PERSISTENT,
      created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY offers_pending_unique (pending_key),
      KEY offers_from_idx (from_user_id, created_at),
      KEY offers_to_idx (to_user_id, created_at),
      KEY offers_listing_idx (listing_id),
      KEY offers_request_idx (request_id),
      CONSTRAINT offers_subject CHECK ((listing_id IS NULL) <> (request_id IS NULL)),
      CONSTRAINT offers_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE,
      CONSTRAINT offers_request_fk FOREIGN KEY (request_id) REFERENCES requests (id) ON DELETE CASCADE,
      CONSTRAINT offers_from_fk FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT offers_to_fk FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT offers_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL
    ) ${TABLE_OPTS}
  `.execute(db)

  await sql`
    CREATE TABLE notifications (
      id         UUID         NOT NULL PRIMARY KEY,
      user_id    UUID         NOT NULL,
      -- 'message' | 'offer' | 'favorite' | 'report' | ...
      type       VARCHAR(30)  NOT NULL,
      title      VARCHAR(200) NOT NULL,
      body       TEXT         NULL,
      link       VARCHAR(500) NULL,
      read_at    DATETIME(3)  NULL,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY notifications_user_idx (user_id, created_at),
      KEY notifications_unread_idx (user_id, read_at),
      CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of ['notifications', 'offers', 'messages', 'conversations']) {
    await sql`DROP TABLE IF EXISTS ${sql.table(t)}`.execute(db)
  }
}
