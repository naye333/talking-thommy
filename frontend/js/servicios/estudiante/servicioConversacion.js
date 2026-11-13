// Conversación con Thommy. Las pantallas solo usan esta interfaz:
//   const sesion = await servicio.iniciar({ tema })
//   sesion.saludo                → { texto, frase }
//   sesion.iniciarTurno()        → el estudiante empieza a hablar
//   sesion.enviarTrozo(blob)     → trozos de audio mientras habla
//   await sesion.finalizarTurno() → { transcripcion, evaluacion, respuesta }
//   sesion.cancelarTurno(), sesion.cerrar()
//
// modo 'ejemplo': respuestas simuladas (tutorEjemplo.js), sin backend.
// modo 'tiempoReal': REST + WebSocket según docs/contrato-api-perfil-estudiante.md
import { ErrorApi } from '../../nucleo/clienteApi.js'
import { crearTutorEjemplo } from './tutorEjemplo.js'
import { crearClienteTiempoReal, construirUrlTiempoReal } from './clienteTiempoReal.js'

function crearSesionEjemplo ({ tema, demoraMs }) {
  const tutor = crearTutorEjemplo(tema)
  let bytesTurno = 0
  let grabando = false

  return {
    id: `ejemplo-${Date.now()}`,
    saludo: tutor.saludo(),
    iniciarTurno () {
      bytesTurno = 0
      grabando = true
    },
    enviarTrozo (trozo) {
      if (grabando) bytesTurno += trozo.size ?? trozo.byteLength ?? 0
    },
    async finalizarTurno () {
      grabando = false
      if (bytesTurno === 0) throw new ErrorApi({ codigo: 'AUDIO_VACIO' })
      if (demoraMs > 0) await new Promise((resolve) => setTimeout(resolve, demoraMs))
      return tutor.responder()
    },
    cancelarTurno () {
      grabando = false
      bytesTurno = 0
    },
    cerrar () {}
  }
}

async function crearSesionTiempoReal ({ tema, cliente, urlApi, obtenerToken, WebSocketImpl }) {
  // POST /api/sesiones (propuesto) → { sesion: { id }, saludo: { texto, frase } }
  const { sesion, saludo } = await cliente.post('/api/sesiones', { temaId: tema?.id ?? null })
  const tiempoReal = crearClienteTiempoReal({
    url: construirUrlTiempoReal(urlApi, { sesionId: sesion.id, token: obtenerToken() }),
    WebSocketImpl
  })
  await tiempoReal.conectar()
  let envios = Promise.resolve()

  return {
    id: sesion.id,
    saludo,
    iniciarTurno () {
      tiempoReal.iniciarTurno()
      envios = Promise.resolve()
    },
    // Los blobs se convierten en orden para no desordenar el audio
    enviarTrozo (trozo) {
      envios = envios.then(async () => tiempoReal.enviarAudio(trozo.arrayBuffer ? await trozo.arrayBuffer() : trozo))
    },
    async finalizarTurno () {
      await envios
      const mensaje = await tiempoReal.finalizarTurno()
      if (mensaje.tipo !== 'resultado_turno') throw new ErrorApi({ codigo: 'TUTOR_NO_DISPONIBLE', estado: 501 })
      return { transcripcion: mensaje.transcripcion, evaluacion: mensaje.evaluacion, respuesta: mensaje.respuesta }
    },
    // El backend descarta el audio anterior al recibir el siguiente "inicio_turno"
    cancelarTurno () {},
    cerrar () {
      tiempoReal.cerrar()
    }
  }
}

export function crearServicioConversacion ({ modo, cliente, urlApi, obtenerToken, demoraMs = 900, WebSocketImpl }) {
  return {
    capacidades: { datosEjemplo: modo === 'ejemplo' },
    iniciar ({ tema = null } = {}) {
      if (modo === 'ejemplo') return Promise.resolve(crearSesionEjemplo({ tema, demoraMs }))
      return crearSesionTiempoReal({ tema, cliente, urlApi, obtenerToken, WebSocketImpl })
    }
  }
}
