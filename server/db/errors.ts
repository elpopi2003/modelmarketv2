/** Códigos de error de MariaDB que la aplicación traduce a mensajes para el usuario. */
const errno = (err: unknown) => (err as { errno?: number } | null)?.errno

/** Clave única repetida (ER_DUP_ENTRY). */
export const isDuplicateKey = (err: unknown) => errno(err) === 1062

/** Referencia a una fila que no existe (ER_NO_REFERENCED_ROW_2). */
export const isMissingReference = (err: unknown) => errno(err) === 1452
