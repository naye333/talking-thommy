import { describir, afirmar } from '../marco.js'
import { crearTutorEjemplo } from '../../js/servicios/estudiante/tutorEjemplo.js'
import { crearServicioConversacion } from '../../js/servicios/estudiante/servicioConversacion.js'
import { crearClienteTiempoReal, construirUrlTiempoReal } from '../../js/servicios/estudiante/clienteTiempoReal.js'
import { crearServicioProgreso } from '../../js/servicios/estudiante/servicioProgreso.js'
import { validarFormularioRegistro } from '../../js/perfiles/comun/pantallas/registro.js'
import { resolverUrlAudio, puedeEscuchar, escucharThommy, callar } from '../../js/servicios/estudiante/voz.js'
import { textoHablado, etiquetaPuntaje, esGrabacionSilenciosa } from '../../js/perfiles/estudiante/pantallas/conversacion.js'

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

  prueba('en tiempo real, el servicio usa el tiempo máximo de respuesta configurado', async () => {
    // El servidor falso no responde al fin del turno: la espera vence según tiempoMaximoMs
    const { WebSocketFalso } = crearWebSocketFalso([])
    const cliente = { post: async () => ({ sesion: { id: 's1' }, saludo: { texto: 'Hi' } }) }
    const servicio = crearServicioConversacion({ modo: 'tiempoReal', cliente, urlApi: '', obtenerToken: () => 't', WebSocketImpl: WebSocketFalso, tiempoMaximoMs: 20 })
    const sesion = await servicio.iniciar({ tema: TEMA })
    sesion.iniciarTurno()
    const inicio = Date.now()
    await afirmar.rechaza(sesion.finalizarTurno(), 'SIN_CONEXION')
    afirmar.verdadero(Date.now() - inicio < 1000)
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

  prueba('resuelve la URL del audio del tutor y rechaza las no válidas', () => {
    afirmar.igual(resolverUrlAudio('https://cdn.ejemplo.co/a.mp3'), 'https://cdn.ejemplo.co/a.mp3')
    afirmar.igual(resolverUrlAudio('/audio/a.mp3', 'https://api.ejemplo.co'), 'https://api.ejemplo.co/audio/a.mp3')
    afirmar.igual(resolverUrlAudio('/audio/a.mp3'), null)
    afirmar.igual(resolverUrlAudio('javascript:alert(1)', 'https://api.ejemplo.co'), null)
    afirmar.igual(resolverUrlAudio(null), null)
    afirmar.igual(resolverUrlAudio(''), null)
  })

  prueba('acepta el audio de Thommy embebido en el mensaje (data:audio) y rechaza otros data:', () => {
    afirmar.igual(resolverUrlAudio('data:audio/mpeg;base64,SUQzBAA='), 'data:audio/mpeg;base64,SUQzBAA=')
    afirmar.igual(resolverUrlAudio('data:audio/wav;base64,UklGRg==', 'https://api.ejemplo.co'), 'data:audio/wav;base64,UklGRg==')
    afirmar.igual(resolverUrlAudio('data:text/html;base64,PHNjcmlwdD4='), null)
    afirmar.igual(resolverUrlAudio('data:audio/mpeg;base64,<script>'), null)
  })

  prueba('avisa cuándo Thommy empieza y termina de hablar (para animar al avatar)', async () => {
    const { AudioFalso, creados } = crearAudioFalso()
    const estados = []
    escucharThommy({ texto: 'Yay!', audioUrl: 'data:audio/mpeg;base64,SUQz' }, { AudioImpl: AudioFalso, leer: () => true, alCambiar: (hablando) => estados.push(hablando) })
    creados[0].dispatchEvent(new Event('playing'))
    creados[0].dispatchEvent(new Event('ended'))
    afirmar.profundo(estados, [true, false])

    // callar también apaga la animación
    escucharThommy({ texto: 'Yay!', audioUrl: 'data:audio/mpeg;base64,SUQz' }, { AudioImpl: AudioFalso, leer: () => true, alCambiar: (hablando) => estados.push(hablando) })
    creados[1].dispatchEvent(new Event('playing'))
    callar()
    afirmar.profundo(estados, [true, false, true, false])
  })

  prueba('con la voz del dispositivo también se anima y se detiene al terminar de leer', () => {
    const estados = []
    let terminarLectura
    escucharThommy({ texto: 'Hi!', audioUrl: null }, {
      AudioImpl: null,
      leer: (_texto, alTerminar) => { terminarLectura = alTerminar; return true },
      alCambiar: (hablando) => estados.push(hablando)
    })
    terminarLectura()
    afirmar.profundo(estados, [true, false])
  })

  prueba('detecta un micrófono que solo entrega silencio absoluto', () => {
    afirmar.igual(esGrabacionSilenciosa({ maximo: 0, mediciones: 120 }), true)
    afirmar.igual(esGrabacionSilenciosa({ maximo: 0.03, mediciones: 120 }), false) // ruido de fondo o voz
    afirmar.igual(esGrabacionSilenciosa({ maximo: 0, mediciones: 3 }), false) // sin datos suficientes: se envía
    afirmar.igual(esGrabacionSilenciosa(null), false)
  })

  prueba('Thommy dice su texto junto con la frase a practicar, y el puntaje usa la etiqueta del backend', () => {
    afirmar.igual(textoHablado({ texto: 'Try saying this:', frase: 'Nice to meet you.' }), 'Try saying this: Nice to meet you.')
    afirmar.igual(textoHablado({ texto: 'What do you like?', frase: null }), 'What do you like?')
    afirmar.igual(etiquetaPuntaje({ etiqueta: 'Palabras entendidas' }), 'Palabras entendidas')
    afirmar.igual(etiquetaPuntaje({}), 'Pronunciación')
  })

  prueba('sin audioUrl, Thommy se escucha con la voz del dispositivo', () => {
    const { AudioFalso, creados } = crearAudioFalso()
    const leidos = []
    escucharThommy({ texto: 'Hi! Try this.', audioUrl: null }, { AudioImpl: AudioFalso, leer: (texto) => leidos.push(texto) })
    afirmar.profundo(leidos, ['Hi! Try this.'])
    afirmar.igual(creados.length, 0)
  })

  prueba('con audioUrl, se reproduce el audio del servidor y no la voz del dispositivo', async () => {
    const { AudioFalso, creados } = crearAudioFalso()
    const leidos = []
    escucharThommy({ texto: 'Well done!', audioUrl: '/audio/1.mp3', urlBase: 'https://api.ejemplo.co' }, { AudioImpl: AudioFalso, leer: (texto) => leidos.push(texto) })
    await Promise.resolve()
    afirmar.igual(creados.length, 1)
    afirmar.igual(creados[0].url, 'https://api.ejemplo.co/audio/1.mp3')
    afirmar.verdadero(creados[0].reproducido)
    afirmar.profundo(leidos, [])
    callar()
  })

  prueba('si el audio no se puede reproducir o falla al cargar, usa la voz del dispositivo', async () => {
    const { AudioFalso, creados } = crearAudioFalso({ rechazarPlay: true })
    const leidos = []
    escucharThommy({ texto: 'Well done!', audioUrl: 'https://cdn.ejemplo.co/1.mp3' }, { AudioImpl: AudioFalso, leer: (texto) => leidos.push(texto) })
    await new Promise((resolve) => setTimeout(resolve))
    afirmar.profundo(leidos, ['Well done!'])

    const conError = crearAudioFalso()
    escucharThommy({ texto: 'Nice work!', audioUrl: 'https://cdn.ejemplo.co/2.mp3' }, { AudioImpl: conError.AudioFalso, leer: (texto) => leidos.push(texto) })
    conError.creados[0].dispatchEvent(new Event('error'))
    afirmar.profundo(leidos, ['Well done!', 'Nice work!'])
    afirmar.igual(creados.length, 1)
  })

  prueba('si play() no devuelve una promesa (navegadores antiguos), el audio se reproduce sin errores', async () => {
    const { AudioFalso, creados } = crearAudioFalso({ playSinPromesa: true })
    const leidos = []
    afirmar.igual(escucharThommy({ texto: 'Well done!', audioUrl: 'https://cdn.ejemplo.co/1.mp3' }, { AudioImpl: AudioFalso, leer: (texto) => leidos.push(texto) }), true)
    await new Promise((resolve) => setTimeout(resolve))
    afirmar.verdadero(creados[0].reproducido)
    afirmar.profundo(leidos, [])
    callar()
  })

  prueba('callar detiene el audio del tutor sin activar la voz de respaldo', async () => {
    const { AudioFalso, creados } = crearAudioFalso({ rechazarPlay: true })
    const leidos = []
    escucharThommy({ texto: 'Well done!', audioUrl: 'https://cdn.ejemplo.co/1.mp3' }, { AudioImpl: AudioFalso, leer: (texto) => leidos.push(texto) })
    callar()
    await new Promise((resolve) => setTimeout(resolve))
    afirmar.verdadero(creados[0].pausado)
    afirmar.profundo(leidos, [])
  })

  prueba('el botón de escuchar aparece si hay audio del tutor aunque el dispositivo no tenga voz', () => {
    const { AudioFalso } = crearAudioFalso()
    // En Node no existe speechSynthesis: solo el audio del servidor permite escuchar
    afirmar.verdadero(puedeEscuchar({ texto: 'Hi', audioUrl: 'https://cdn.ejemplo.co/1.mp3' }, { AudioImpl: AudioFalso }))
    afirmar.igual(puedeEscuchar({ texto: 'Hi', audioUrl: null }, { AudioImpl: AudioFalso }), false)
  })
})

// Audio falso: registra lo que se reproduce; play() puede rechazarse como cuando el dispositivo lo bloquea
function crearAudioFalso ({ rechazarPlay = false, playSinPromesa = false } = {}) {
  const creados = []
  class AudioFalso extends EventTarget {
    constructor (url) {
      super()
      this.url = url
      creados.push(this)
    }

    play () {
      this.reproducido = true
      if (playSinPromesa) return
      return rechazarPlay ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve()
    }

    pause () { this.pausado = true }
  }
  return { AudioFalso, creados }
}
