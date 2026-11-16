// Servidor estático de desarrollo, sin dependencias.
// Uso: npm run dev   (o: node servidor-dev.js)
// Usa el puerto 8081 porque es el que el backend permite por defecto en ORIGENES_PERMITIDOS.
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
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

// Solo se sirven los archivos que existen al arrancar dentro de estas carpetas: la URL nunca se usa
// para armar una ruta del disco, así no se puede salir de la carpeta del frontend (/../backend/.env)
const CONTENIDO_PUBLICO = ['index.html', 'css', 'js', 'assets', 'pruebas']

async function listarArchivos (ruta) {
  const entradas = await readdir(ruta, { withFileTypes: true }).catch(() => null)
  if (!entradas) return [ruta]
  const anidados = await Promise.all(entradas.map((entrada) => listarArchivos(join(ruta, entrada.name))))
  return anidados.flat()
}

const ARCHIVOS = new Map()
for (const elemento of CONTENIDO_PUBLICO) {
  for (const archivo of await listarArchivos(join(RAIZ, elemento))) {
    ARCHIVOS.set('/' + relative(RAIZ, archivo).split(sep).join('/'), archivo)
  }
}

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost')
    const solicitada = decodeURIComponent(pathname)
    const ruta = ARCHIVOS.get(solicitada.endsWith('/') ? solicitada + 'index.html' : solicitada)
    if (!ruta) throw new Error('no existe')

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
