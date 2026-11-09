import type { Migration } from 'kysely/migration'

/**
 * Registro ordenado de migraciones. Cada fichero exporta `up` (y `down` cuando es
 * reversible). El nombre de la clave fija el orden: `AAAAMMDDHHMM_descripcion`.
 *
 * Convención (CLAUDE.md §6, adaptada a MariaDB): una migración por cambio, con la tabla,
 * sus índices y claves foráneas en el mismo fichero. No hay RLS: los permisos los aplica
 * la capa de políticas del servidor (`server/policies`).
 */
export const migrations: Record<string, Migration> = {}
