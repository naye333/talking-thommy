// Servidor estático de desarrollo, sin dependencias.
// Uso: npm run dev   (o: node servidor-dev.js)
// Usa el puerto 8081 porque es el que el backend permite por defecto en ORIGENES_PERMITIDOS.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)))
const PUERTO = Number(process.env.PUERTO) || 8081

const TIPOS_CONTENIDO = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost')
    const relativa = decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
    const ruta = resolve(RAIZ, '.' + relativa)

    // Evita salir de la carpeta del frontend con rutas como /../backend/.env
    if (!ruta.startsWith(RAIZ + sep)) {
      response.writeHead(403).end()
      return
    }

    const contenido = await readFile(ruta)
    response.writeHead(200, {
      'Content-Type': TIPOS_CONTENIDO[extname(ruta)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    response.end(contenido)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado')
  }
}).listen(PUERTO, () => {
  console.log(`[frontend] http://localhost:${PUERTO}`)
})
