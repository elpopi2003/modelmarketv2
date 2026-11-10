import type { Migration } from 'kysely/migration'
import * as m202611090001 from './202611090001_users_profiles_roles'
import * as m202611090002 from './202611090002_email_outbox'
import * as m202611100001 from './202611100001_content'
import * as m202611110001 from './202611110001_messaging'
import * as m202611120001 from './202611120001_reports'

/**
 * Registro ordenado de migraciones. Cada fichero exporta `up` (y `down` cuando es
 * reversible). El nombre de la clave fija el orden: `AAAAMMDDNNNN_descripcion`.
 *
 * Convención (CLAUDE.md §6, adaptada a MariaDB): una migración por cambio, con la tabla,
 * sus índices y claves foráneas en el mismo fichero. No hay RLS: los permisos los aplica
 * la capa de políticas del servidor (`server/policies`).
 */
export const migrations: Record<string, Migration> = {
  '202611090001_users_profiles_roles': m202611090001,
  '202611090002_email_outbox': m202611090002,
  '202611100001_content': m202611100001,
  '202611110001_messaging': m202611110001,
  '202611120001_reports': m202611120001,
}
