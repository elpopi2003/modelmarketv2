// Fichero de arranque para Plesk (Node.js > "Archivo de inicio de la aplicación").
// Passenger carga los arranques con require(); el servidor es un módulo ES con await de
// nivel superior, así que se importa dinámicamente desde aquí.
import('../server-dist/index.mjs').catch((err) => {
  console.error(err)
  process.exit(1)
})
