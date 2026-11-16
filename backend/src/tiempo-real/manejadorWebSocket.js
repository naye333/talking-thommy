const { WebSocketServer } = require('ws')
const { BufferAudio } = require('./bufferAudio')
const entorno = require('../config/entorno')
const { verificarToken } = require('../servicios/servicioAutenticacion')
const servicioSesiones = require('../servicios/servicioSesiones')

const RUTA_TIEMPO_REAL = '/tiempo-real'
const INTERVALO_LATIDO_MS = 30000

function enviarMensaje (socket, mensaje) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(mensaje))
  }
}

// Turno completo con la IA: Whisper (transcripción) → evaluación → Thommy (Ollama) → voz (Piper)
async function procesarTurno (audio, contexto) {
  return servicioSesiones.procesarTurno({ sesionId: contexto.sesionId, usuarioId: contexto.usuarioId, audio })
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
      // La cadena termina en .catch: ningún error del procesamiento queda sin manejar
      procesarTurno(audio, contexto)
        .then((resultado) => enviarMensaje(socket, resultado))
        .catch((error) => {
          // Errores conocidos (AUDIO_NO_ENTENDIDO, TUTOR_NO_DISPONIBLE…) se envían con su código
          if (!error.codigo) console.error('[ws] error procesando turno:', error.message)
          enviarMensaje(socket, { tipo: 'error', codigo: error.codigo || 'ERROR_PROCESAMIENTO' })
        })
      return
    }

    default:
      return enviarMensaje(socket, { tipo: 'error', codigo: 'TIPO_DESCONOCIDO' })
  }
}

function manejarConexion (socket, request) {
  const url = new URL(request.url, 'http://localhost')
  const sesionId = url.searchParams.get('sesion')

  let usuario
  try {
    usuario = verificarToken(url.searchParams.get('token') || '')
  } catch {
    enviarMensaje(socket, { tipo: 'error', codigo: 'TOKEN_INVALIDO' })
    return socket.close(1008, 'token invalido')
  }

  if (!sesionId) {
    enviarMensaje(socket, { tipo: 'error', codigo: 'SESION_REQUERIDA' })
    return socket.close(1008, 'sesion requerida')
  }

  // La sesión debe haberse creado con POST /api/sesiones y pertenecer a este estudiante
  try {
    servicioSesiones.verificarPropietario(sesionId, usuario.id)
  } catch (error) {
    enviarMensaje(socket, { tipo: 'error', codigo: error.codigo })
    return socket.close(1008, 'sesion no encontrada')
  }

  const contexto = { sesionId, usuarioId: usuario.id }
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
