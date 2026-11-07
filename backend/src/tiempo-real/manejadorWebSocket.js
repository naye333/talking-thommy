const { WebSocketServer } = require('ws')
const { BufferAudio } = require('./bufferAudio')
const entorno = require('../config/entorno')

const RUTA_TIEMPO_REAL = '/tiempo-real'
const INTERVALO_LATIDO_MS = 30000

function enviarMensaje (socket, mensaje) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(mensaje))
  }
}

// Punto de extensión: aquí se conectarán Whisper, el análisis fonético y el tutor (paso 5)
async function procesarTurno (audio, contexto) {
  return { tipo: 'turno_recibido', bytes: audio.length, sesionId: contexto.sesionId }
}

function manejarMensajeControl (socket, buffer, datos, contexto) {
  let mensaje
  try {
    mensaje = JSON.parse(datos.toString())
  } catch {
    return enviarMensaje(socket, { tipo: 'error', codigo: 'JSON_INVALIDO' })
  }

  switch (mensaje.tipo) {
    case 'inicio_turno':
      buffer.iniciarTurno()
      return enviarMensaje(socket, { tipo: 'turno_iniciado' })

    case 'fin_turno': {
      if (!buffer.estaGrabando) {
        return enviarMensaje(socket, { tipo: 'error', codigo: 'TURNO_NO_INICIADO' })
      }
      const audio = buffer.finalizarTurno()
      if (audio.length === 0) {
        return enviarMensaje(socket, { tipo: 'error', codigo: 'AUDIO_VACIO' })
      }
      enviarMensaje(socket, { tipo: 'procesando' })
      return procesarTurno(audio, contexto)
        .then((resultado) => enviarMensaje(socket, resultado))
        .catch((error) => {
          console.error('[ws] error procesando turno:', error.message)
          enviarMensaje(socket, { tipo: 'error', codigo: 'ERROR_PROCESAMIENTO' })
        })
    }

    default:
      return enviarMensaje(socket, { tipo: 'error', codigo: 'TIPO_DESCONOCIDO' })
  }
}

function manejarConexion (socket, request) {
  const url = new URL(request.url, 'http://localhost')
  const sesionId = url.searchParams.get('sesion')

  // TODO (feature/autenticacion): validar el JWT del parámetro "token"
  if (!sesionId) {
    enviarMensaje(socket, { tipo: 'error', codigo: 'SESION_REQUERIDA' })
    return socket.close(1008, 'sesion requerida')
  }

  const contexto = { sesionId }
  const buffer = new BufferAudio(entorno.maxBytesAudioTurno)
  socket.estaVivo = true

  socket.on('pong', () => { socket.estaVivo = true })

  socket.on('message', (datos, esBinario) => {
    if (esBinario) {
      const fueAgregado = buffer.agregarTrozo(datos)
      if (!fueAgregado) {
        const codigo = buffer.estaGrabando ? 'AUDIO_DEMASIADO_GRANDE' : 'TURNO_NO_INICIADO'
        if (codigo === 'AUDIO_DEMASIADO_GRANDE') buffer.limpiar()
        enviarMensaje(socket, { tipo: 'error', codigo })
      }
      return
    }
    manejarMensajeControl(socket, buffer, datos, contexto)
  })

  socket.on('close', () => buffer.limpiar())
  socket.on('error', (error) => console.error('[ws]', error.message))

  enviarMensaje(socket, { tipo: 'conectado', sesionId })
}

// Adjunta el servidor WebSocket al mismo servidor HTTP de Express
function crearServidorWebSocket (servidorHttp) {
  const servidorWs = new WebSocketServer({ server: servidorHttp, path: RUTA_TIEMPO_REAL })

  servidorWs.on('connection', manejarConexion)

  // Latido: cierra conexiones que dejaron de responder
  const latido = setInterval(() => {
    servidorWs.clients.forEach((socket) => {
      if (!socket.estaVivo) return socket.terminate()
      socket.estaVivo = false
      socket.ping()
    })
  }, INTERVALO_LATIDO_MS)

  servidorWs.on('close', () => clearInterval(latido))

  return servidorWs
}

module.exports = { crearServidorWebSocket, RUTA_TIEMPO_REAL }
