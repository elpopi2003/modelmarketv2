// Servidor estático mínimo para previsualizar la landing (carpeta landing/) en local.
// Solo para desarrollo: `node scripts/serve-landing.mjs`. No se despliega.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../landing/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const PORT = 4599
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split('?')[0])
    if (path === '/') path = '/index.html'
    const file = normalize(join(ROOT, path))
    if (!file.startsWith(normalize(ROOT))) {
      res.writeHead(403).end('Forbidden')
      return
    }
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(PORT, () => console.log(`Landing en http://localhost:${PORT}`))
