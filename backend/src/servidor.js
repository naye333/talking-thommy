const http = require('http')
const entorno = require('./config/entorno')
const { crearApp } = require('./app')
const { crearServidorWebSocket } = require('./tiempo-real/manejadorWebSocket')
const { cerrarPool, verificarConexion } = require('./config/baseDatos')
const { revisarConfiguracion, formatearProblema, explicarErrorBaseDatos } = require('./config/diagnostico')
const { prepararBaseDatos } = require('./bd/prepararBaseDatos')

// REST y WebSocket comparten el mismo puerto (necesario en Render)
// opciones se pasa al WebSocket (permite reemplazar la IA y la BD en pruebas)
function iniciarServidor (puerto = entorno.puerto, opciones = {}) {
  const servidorHttp = http.createServer(crearApp())
  const servidorWs = crearServidorWebSocket(servidorHttp, opciones)

  return new Promise((resolve) => {
    servidorHttp.listen(puerto, () => {
      resolve({ servidorHttp, servidorWs })
    })
  })
}

async function detenerServidor ({ servidorHttp, servidorWs }) {
  servidorWs.clients.forEach((socket) => socket.terminate())
  await new Promise((resolve) => servidorWs.close(resolve))
  await new Promise((resolve) => servidorHttp.close(resolve))
  await cerrarPool()
}

// Avisa en la consola lo que falta configurar. En producción, sin base de datos no arranca.
async function avisarConfiguracion () {
  const problemas = revisarConfiguracion()
  for (const problema of problemas) console.warn(`[configuracion] ${formatearProblema(problema)}`)
  if (entorno.esProduccion && !entorno.urlBaseDatos) {
    throw new Error('Falta DATABASE_URL en las variables de entorno de producción')
  }
  if (!entorno.urlBaseDatos) return

  const { estaConectada, motivo } = await verificarConexion()
  if (!estaConectada) {
    console.warn(`[bd] ✘ no se pudo conectar: ${explicarErrorBaseDatos(motivo)}`)
    return
  }
  console.log('[bd] conectada a la base de datos')
  if (!entorno.migrarAlArrancar) return
  try {
    await prepararBaseDatos()
  } catch (error) {
    // En producción no se sirve con la base a medias; en desarrollo se avisa y se sigue
    if (entorno.esProduccion) throw new Error(`no se pudo preparar la base de datos: ${error.message}`)
    console.warn(`[bd] ✘ no se pudo preparar la base de datos: ${error.message}`)
  }
}

// Inicia el servidor y registra el apagado ordenado con Ctrl + C o la señal de Render
async function arrancar (puerto) {
  await avisarConfiguracion()
  const servidores = await iniciarServidor(puerto)
  const { port } = servidores.servidorHttp.address()
  console.log(`[servidor] REST en http://localhost:${port}/api`)
  console.log(`[servidor] WebSocket en ws://localhost:${port}/tiempo-real`)

  const apagar = () => {
    detenerServidor(servidores)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('[servidor] error al apagar:', error.message)
        process.exit(1)
      })
  }
  process.on('SIGINT', apagar)
  process.on('SIGTERM', apagar)
  return { servidores, apagar }
}

if (require.main === module) {
  arrancar().catch((error) => {
    console.error('[servidor] no se pudo iniciar:', error.message)
    process.exit(1)
  })
}

module.exports = { iniciarServidor, detenerServidor, arrancar, avisarConfiguracion }
