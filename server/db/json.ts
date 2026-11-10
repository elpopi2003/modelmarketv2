/**
 * Columnas JSON de MariaDB: según la versión, mysql2 las entrega ya convertidas o como
 * texto. Estas funciones normalizan ambos casos.
 */
export function jsonArray<T = string>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string' && value) {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  }
  return []
}

export const toJson = (value: unknown) => JSON.stringify(value)
