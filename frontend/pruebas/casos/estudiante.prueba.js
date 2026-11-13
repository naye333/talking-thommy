import { describir, afirmar } from '../marco.js'
import { crearTutorEjemplo } from '../../js/servicios/estudiante/tutorEjemplo.js'
import { crearServicioConversacion } from '../../js/servicios/estudiante/servicioConversacion.js'
import { crearClienteTiempoReal, construirUrlTiempoReal } from '../../js/servicios/estudiante/clienteTiempoReal.js'
import { crearServicioProgreso } from '../../js/servicios/estudiante/servicioProgreso.js'
import { validarFormularioRegistro } from '../../js/perfiles/comun/pantallas/registro.js'

const TEMA = { id: 3, titulo: 'Introducing yourself', frasesModelo: ['Hi, let me introduce myself.', 'Nice to meet you.'] }

// WebSocket falso que responde como el backend
function crearWebSocketFalso (respuestas) {
  const enviados = []
  class WebSocketFalso extends EventTarget {
    static OPEN = 1
    constructor (url) {
      super()
      this.url = url
      this.readyState = 1
      WebSocketFalso.ultimo = this
      setTimeout(() => this.recibir({ tipo: 'conectado', sesionId: 's1' }))
    }

    recibir (mensaje) {
      const evento = new Event('message')
      evento.data = JSON.stringify(mensaje)
      this.dispatchEvent(evento)
    }

    send (datos) {
      enviados.push(datos)
      if (typeof datos === 'string' && JSON.parse(datos).tipo === 'fin_turno') {
        setTimeout(() => respuestas.forEach((mensaje) => this.recibir(mensaje)))
      }
    }

    close () { this.readyState = 3 }
  }
  return { WebSocketFalso, enviados }
}

describir('estudiante', (prueba) => {
  prueba('el tutor de ejemplo propone las frases del tema y alterna resultados', () => {
    const tutor = crearTutorEjemplo(TEMA)
    afirmar.igual(tutor.saludo().frase, 'Hi, let me introduce myself.')
    const primero = tutor.responder()
    afirmar.igual(primero.evaluacion.nivel, 'excelente')
    afirmar.igual(primero.respuesta.frase, 'Nice to meet you.')
    const segundo = tutor.responder()
    afirmar.igual(segundo.evaluacion.nivel, 'practicar')
    afirmar.verdadero(segundo.evaluacion.palabras.some((palabra) => !palabra.correcta && palabra.sugerencia))
  })

  prueba('sin tema, el tutor usa frases de conversación libre', () => {
    afirmar.verdadero(crearTutorEjemplo(null).saludo().frase.length > 0)
  })

  prueba('la sesión de ejemplo rechaza un turno sin audio', async () => {
    const sesion = await crearServicioConversacion({ modo: 'ejemplo', demoraMs: 0 }).iniciar({ tema: TEMA })
    sesion.iniciarTurno()
    await afirmar.rechaza(sesion.finalizarTurno(), 'AUDIO_VACIO')
  })

  prueba('la sesión de ejemplo responde cuando hubo audio', async () => {
    const sesion = await crearServicioConversacion({ modo: 'ejemplo', demoraMs: 0 }).iniciar({ tema: TEMA })
    sesion.iniciarTurno()
    sesion.enviarTrozo({ size: 1200 })
    const resultado = await sesion.finalizarTurno()
    afirmar.igual(resultado.transcripcion, 'Hi, let me introduce myself.')
  })

  prueba('arma la URL del WebSocket a partir de la URL de la API', () => {
    afirmar.igual(construirUrlTiempoReal('https://api.ejemplo.co/', { sesionId: 'a b', token: 't' }), 'wss://api.ejemplo.co/tiempo-real?sesion=a+b&token=t')
  })

  prueba('el cliente de tiempo real sigue el protocolo y devuelve resultado_turno', async () => {
    const resultado = { tipo: 'resultado_turno', transcripcion: 'hola', evaluacion: {}, respuesta: {} }
    const { WebSocketFalso, enviados } = crearWebSocketFalso([{ tipo: 'procesando' }, resultado])
    const cliente = crearClienteTiempoReal({ url: 'ws://x', WebSocketImpl: WebSocketFalso })
    await cliente.conectar()
    cliente.iniciarTurno()
    cliente.enviarAudio(new Uint8Array([1, 2]))
    const mensaje = await cliente.finalizarTurno()
    afirmar.igual(mensaje.transcripcion, 'hola')
    afirmar.igual(enviados[0], '{"tipo":"inicio_turno"}')
    afirmar.igual(enviados[2], '{"tipo":"fin_turno"}')
  })

  prueba('un error del servidor rechaza el turno con su código', async () => {
    const { WebSocketFalso } = crearWebSocketFalso([{ tipo: 'error', codigo: 'AUDIO_VACIO' }])
    const cliente = crearClienteTiempoReal({ url: 'ws://x', WebSocketImpl: WebSocketFalso })
    await cliente.conectar()
    cliente.iniciarTurno()
    await afirmar.rechaza(cliente.finalizarTurno(), 'AUDIO_VACIO')
  })

  prueba('en tiempo real, el backend actual sin IA se reporta como TUTOR_NO_DISPONIBLE', async () => {
    const { WebSocketFalso } = crearWebSocketFalso([{ tipo: 'turno_recibido', bytes: 2 }])
    const cliente = { post: async () => ({ sesion: { id: 's1' }, saludo: { texto: 'Hi' } }) }
    const servicio = crearServicioConversacion({ modo: 'tiempoReal', cliente, urlApi: 'http://x', obtenerToken: () => 't', WebSocketImpl: WebSocketFalso })
    const sesion = await servicio.iniciar({ tema: TEMA })
    afirmar.verdadero(WebSocketFalso.ultimo.url.includes('sesion=s1'))
    sesion.iniciarTurno()
    sesion.enviarTrozo(new Uint8Array([1, 2]))
    await afirmar.rechaza(sesion.finalizarTurno(), 'TUTOR_NO_DISPONIBLE')
  })

  prueba('el progreso de ejemplo trae reporte y evolución', async () => {
    const progreso = await crearServicioProgreso({ usarDatosEjemplo: true, demoraMs: 0 }).obtenerProgreso({ periodo: 'ultimo_mes' })
    afirmar.igual(progreso.areas.length, 4)
    afirmar.igual(progreso.evolucion.at(-1).valor, progreso.promedioGeneral)
    afirmar.igual(progreso.estudiante, undefined)
  })

  prueba('valida el formulario de registro', () => {
    const valido = { nombre: 'Ana', correo: 'ana@usta.edu.co', contrasena: 'clave12345', confirmacion: 'clave12345', nivel: 1 }
    afirmar.profundo(validarFormularioRegistro(valido), {})
    const errores = validarFormularioRegistro({ ...valido, nombre: '', confirmacion: 'otra', nivel: 0 })
    afirmar.profundo(Object.keys(errores), ['nombre', 'confirmacion', 'nivel'])
  })
})
