import { sql, type Kysely } from 'kysely'

/**
 * Denuncias de usuarios sobre un anuncio, una petición o un usuario.
 *
 * pending_key: una sola denuncia pendiente por denunciante y objetivo (equivale a los tres
 * índices únicos parciales de Postgres). Es NULL en cuanto se resuelve o se descarta.
 * Si el objetivo se borra, la denuncia se conserva (historial de moderación).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE reports (
      id               UUID         NOT NULL PRIMARY KEY,
      reporter_id      UUID         NOT NULL,
      listing_id       UUID         NULL,
      request_id       UUID         NULL,
      reported_user_id UUID         NULL,
      reason           ENUM('spam', 'prohibited', 'counterfeit', 'misleading', 'offensive', 'other') NOT NULL,
      details          TEXT         NULL,
      status           ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
      resolved_by      UUID         NULL,
      resolved_at      DATETIME(3)  NULL,
      resolution_note  TEXT         NULL,
      pending_key      VARCHAR(80)  AS (IF(status = 'pending', CONCAT(reporter_id, ':', COALESCE(listing_id, request_id, reported_user_id)), NULL)) PERSISTENT,
      created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY reports_pending_unique (pending_key),
      KEY reports_status_idx (status, created_at),
      KEY reports_listing_idx (listing_id),
      KEY reports_request_idx (request_id),
      KEY reports_reported_user_idx (reported_user_id),
      CONSTRAINT reports_one_target CHECK (
        (listing_id IS NOT NULL) + (request_id IS NOT NULL) + (reported_user_id IS NOT NULL) = 1
      ),
      CONSTRAINT reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT reports_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS reports`.execute(db)
}
