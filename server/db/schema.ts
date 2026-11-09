/**
 * Tipos de las tablas de MariaDB para Kysely.
 *
 * Se mantienen a mano junto a las migraciones (`server/db/migrations`): cada migración que
 * cambia una tabla actualiza aquí su interfaz en el mismo commit.
 */
// Las tablas se añaden en las migraciones de M8a (usuarios, sesiones, perfiles, roles…).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}
