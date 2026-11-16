// Cliente del WebSocket /tiempo-real (backend/src/tiempo-real/manejadorWebSocket.js).
// Protocolo: ver docs/contrato-api-perfil-estudiante.md
import { ErrorApi } from '../../nucleo/clienteApi.js'

const TIEMPO_MAXIMO_MS = 30000

export function construirUrlTiempoReal (urlApi, { sesionId, token }) {
  const base = urlApi.replace(/^http/, 'ws').replace(/\/$/, '')
  const query = new URLSearchParams({ sesion: sesionId, token })
  return `${base}/tiempo-real?${query}`
}

export function crearClienteTiempoReal ({ url, WebSocketImpl = globalThis.WebSocket, tiempoMaximoMs = TIEMPO_MAXIMO_MS }) {
  let socket = null
  let esperaActual = null // { resolver, rechazar, tipos, temporizador }

  function terminarEspera (accion, valor) {
    if (!esperaActual) return
    clearTimeout(esperaActual.temporizador)
    const espera = esperaActual
    esperaActual = null
    espera[accion](valor)
  }

  // Espera el siguiente mensaje con alguno de los tipos dados; un mensaje "error" rechaza
  function esperar (tipos) {
    return new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(() => terminarEspera('rechazar', new ErrorApi({ codigo: 'SIN_CONEXION' })), tiempoMaximoMs)
      esperaActual = { resolver, rechazar, tipos, temporizador }
    })
  }

  function alRecibir (evento) {
    if (typeof evento.data !== 'string') return
    let mensaje
    try {
      mensaje = JSON.parse(evento.data)
    } catch {
      return
    }
    if (!esperaActual) return
    if (mensaje.tipo === 'error') terminarEspera('rechazar', new ErrorApi({ codigo: mensaje.codigo || 'ERROR_PROCESAMIENTO' }))
    else if (esperaActual.tipos.includes(mensaje.tipo)) terminarEspera('resolver', mensaje)
  }

  function enviarControl (tipo) {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN) throw new ErrorApi({ codigo: 'SIN_CONEXION' })
    socket.send(JSON.stringify({ tipo }))
  }

  return {
    async conectar () {
      socket = new WebSocketImpl(url)
      socket.binaryType = 'arraybuffer'
      socket.addEventListener('message', alRecibir)
      socket.addEventListener('close', () => terminarEspera('rechazar', new ErrorApi({ codigo: 'SIN_CONEXION' })))
      socket.addEventListener('error', () => terminarEspera('rechazar', new ErrorApi({ codigo: 'SIN_CONEXION' })))
      return esperar(['conectado'])
    },

    iniciarTurno () {
      enviarControl('inicio_turno')
    },

    enviarAudio (datos) {
      if (socket?.readyState === WebSocketImpl.OPEN) socket.send(datos)
    },

    // Resuelve con "resultado_turno" (contrato) o "turno_recibido" (backend actual, sin IA)
    finalizarTurno () {
      const resultado = esperar(['resultado_turno', 'turno_recibido'])
      enviarControl('fin_turno')
      return resultado
    },

    cerrar () {
      terminarEspera('rechazar', new ErrorApi({ codigo: 'SIN_CONEXION' }))
      if (socket && socket.readyState <= 1) socket.close()
      socket = null
    }
  }
}
