// Copia solo los archivos de la app a www/, que es la carpeta que Capacitor empaqueta en el APK.
// Uso: npm run build            → usa la URL del backend de js/config.js
//      URL_API=https://... npm run build  → reemplaza la URL del backend en la copia
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const DESTINO = join(RAIZ, 'www')
const CONTENIDO_APP = ['index.html', 'css', 'js', 'assets']

await rm(DESTINO, { recursive: true, force: true })
await mkdir(DESTINO)
for (const elemento of CONTENIDO_APP) {
  await cp(join(RAIZ, elemento), join(DESTINO, elemento), { recursive: true })
}

const urlApi = process.env.URL_API
if (urlApi) {
  const rutaConfig = join(DESTINO, 'js', 'config.js')
  const original = await readFile(rutaConfig, 'utf8')
  const actualizado = original.replace(/urlApi: '[^']*'/, `urlApi: '${urlApi.replace(/\/$/, '')}'`)
  if (actualizado === original) throw new Error('No se encontró urlApi en js/config.js')
  await writeFile(rutaConfig, actualizado)
}

console.log(`[build] app copiada a www/${urlApi ? ` · backend: ${urlApi}` : ''}`)
