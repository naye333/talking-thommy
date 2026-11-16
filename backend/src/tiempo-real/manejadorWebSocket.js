const { WebSocketServer } = require('ws')
const { BufferAudio } = require('./bufferAudio')
const entorno = require('../config/entorno')
const { verificarToken } = require('../servicios/servicioAutenticacion')
const { crearProcesadorTurno } = require('../servicios/procesadorTurno')
const { cargarContextoSesion } = require('./contextoSesion')

const RUTA_TIEMPO_REAL = '/tiempo-real'
const INTERVALO_LATIDO_MS = 30000

function enviarMensaje (socket, mensaje) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(mensaje))
  }
}

function cerrarConError (socket, codigo, razon) {
  enviarMensaje(socket, { tipo: 'error', codigo })
  socket.close(1008, razon)
}

function manejarMensajeControl (socket, buffer, datos, contexto, procesarTurno) {
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
      // Un turno a la vez: la frase objetivo del siguiente depende de la respuesta del anterior
      if (contexto.estaProcesando) {
        buffer.limpiar()
        return enviarMensaje(socket, { tipo: 'error', codigo: 'TURNO_EN_PROCESO' })
      }
      const audio = buffer.finalizarTurno()
      if (audio.length === 0) {
        return enviarMensaje(socket, { tipo: 'error', codigo: 'AUDIO_VACIO' })
      }
      enviarMensaje(socket, { tipo: 'procesando' })
      contexto.estaProcesando = true
      // La cadena termina en .catch: ningún error del procesamiento queda sin manejar
      procesarTurno(audio, contexto)
        .then((resultado) => enviarMensaje(socket, resultado))
        .catch((error) => {
          if (!error.codigo) console.error('[ws] error procesando turno:', error.message)
          enviarMensaje(socket, { tipo: 'error', codigo: error.codigo || 'ERROR_PROCESAMIENTO' })
        })
        .finally(() => { contexto.estaProcesando = false })
      return
    }

    default:
      return enviarMensaje(socket, { tipo: 'error', codigo: 'TIPO_DESCONOCIDO' })
  }
}

function crearManejadorConexion ({ procesarTurno, cargarContexto }) {
  return function manejarConexion (socket, request) {
    const url = new URL(request.url, 'http://localhost')
    const sesionId = url.searchParams.get('sesion')

    let usuario
    try {
      usuario = verificarToken(url.searchParams.get('token') || '')
    } catch {
      return cerrarConError(socket, 'TOKEN_INVALIDO', 'token invalido')
    }

    if (!sesionId) return cerrarConError(socket, 'SESION_REQUERIDA', 'sesion requerida')

    const buffer = new BufferAudio(entorno.maxBytesAudioTurno)
    socket.estaVivo = true
    socket.on('pong', () => { socket.estaVivo = true })
    socket.on('close', () => buffer.limpiar())
    socket.on('error', (error) => console.error('[ws]', error.message))

    // Los mensajes que lleguen mientras se carga la sesión esperan a que termine (en orden)
    const preparacion = cargarContexto(usuario, sesionId)
      .then((contexto) => {
        enviarMensaje(socket, { tipo: 'conectado', sesionId })
        return contexto
      })
      .catch((error) => {
        if (!error.codigo) console.error('[ws] error cargando la sesión:', error.message)
        cerrarConError(socket, error.codigo || 'ERROR_PROCESAMIENTO', 'sesion no disponible')
        return null
      })

    socket.on('message', (datos, esBinario) => {
      preparacion.then((contexto) => {
        if (!contexto) return
        if (esBinario) {
          const fueAgregado = buffer.agregarTrozo(datos)
          if (!fueAgregado) {
            const codigo = buffer.estaGrabando ? 'AUDIO_DEMASIADO_GRANDE' : 'TURNO_NO_INICIADO'
            if (codigo === 'AUDIO_DEMASIADO_GRANDE') buffer.limpiar()
            enviarMensaje(socket, { tipo: 'error', codigo })
          }
          return
        }
        manejarMensajeControl(socket, buffer, datos, contexto, procesarTurno)
      })
    })
  }
}

// Adjunta el servidor WebSocket al mismo servidor HTTP de Express.
// opciones.procesarTurno y opciones.cargarContexto permiten reemplazar la IA y la BD en pruebas.
function crearServidorWebSocket (servidorHttp, opciones = {}) {
  const servidorWs = new WebSocketServer({ server: servidorHttp, path: RUTA_TIEMPO_REAL })

  servidorWs.on('connection', crearManejadorConexion({
    procesarTurno: opciones.procesarTurno || crearProcesadorTurno(),
    cargarContexto: opciones.cargarContexto || cargarContextoSesion
  }))

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
