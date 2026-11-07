const http = require('http')
const entorno = require('./config/entorno')
const { crearApp } = require('./app')
const { crearServidorWebSocket } = require('./tiempo-real/manejadorWebSocket')
const { cerrarPool } = require('./config/baseDatos')

// REST y WebSocket comparten el mismo puerto (necesario en Render)
function iniciarServidor (puerto = entorno.puerto) {
  const servidorHttp = http.createServer(crearApp())
  const servidorWs = crearServidorWebSocket(servidorHttp)

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

if (require.main === module) {
  iniciarServidor().then((servidores) => {
    const { port } = servidores.servidorHttp.address()
    console.log(`[servidor] REST en http://localhost:${port}/api`)
    console.log(`[servidor] WebSocket en ws://localhost:${port}/tiempo-real`)

    const apagar = () => detenerServidor(servidores).then(() => process.exit(0))
    process.on('SIGINT', apagar)
    process.on('SIGTERM', apagar)
  })
}

module.exports = { iniciarServidor, detenerServidor }
