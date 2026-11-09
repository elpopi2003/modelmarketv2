import {
  Migrator,
  type Migration,
  type MigrationProvider,
  type MigrationResultSet,
} from 'kysely/migration'
import type { Db } from './client'
import { migrations } from './migrations'

/**
 * Proveedor estático: las migraciones se importan en `migrations/index.ts` en lugar de
 * leerse del disco, para que funcionen igual en desarrollo (tsx) que empaquetadas (tsup).
 */
class StaticProvider implements MigrationProvider {
  constructor(private readonly items: Record<string, Migration>) {}
  async getMigrations() {
    return this.items
  }
}

export function createMigrator(db: Db) {
  return new Migrator({
    db,
    provider: new StaticProvider(migrations),
    migrationTableName: 'schema_migrations',
    migrationLockTableName: 'schema_migrations_lock',
  })
}

/** Aplica todas las migraciones pendientes. Lanza si alguna falla. */
export async function migrateToLatest(db: Db): Promise<string[]> {
  const { error, results } = await createMigrator(db).migrateToLatest()
  return unwrap(error, results)
}

/** Deshace la última migración aplicada (solo para desarrollo). */
export async function migrateDown(db: Db): Promise<string[]> {
  const { error, results } = await createMigrator(db).migrateDown()
  return unwrap(error, results)
}

function unwrap(error: unknown, results: MigrationResultSet['results']): string[] {
  const failed = results?.find((r) => r.status === 'Error')
  if (error || failed) {
    const name = failed ? ` (${failed.migrationName})` : ''
    throw new Error(
      `La migración falló${name}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return (results ?? []).map((r) => `${r.direction === 'Up' ? '↑' : '↓'} ${r.migrationName}`)
}
