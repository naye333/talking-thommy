const WebSocket = require('ws')

// Servicio de IA simulado: las pruebas no necesitan Whisper, Ollama ni Piper
jest.mock('../src/servicios/servicioTutorIa', () => ({
  iniciarSesion: jest.fn(),
  procesarAudio: jest.fn()
}))

const servicioTutorIa = require('../src/servicios/servicioTutorIa')
const { sesionesActivas } = require('../src/servicios/servicioSesiones')
const { iniciarServidor, detenerServidor } = require('../src/servidor')
const { generarToken } = require('../src/servicios/servicioAutenticacion')
const { crearError } = require('../src/utilidades/errores')

const token = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })

const TURNO_IA = {
  transcription: 'Hi, let me in produce myself.',
  reply: 'Good job! Almost perfect! Listen and say it slowly:',
  phrase: 'Hi, let me introduce myself.',
  correction: null,
  evaluation: {
    kind: 'phrase',
    label_es: 'Palabras entendidas',
    score: 80,
    level: 'bien',
    message_es: 'Casi perfecto. Thommy no entendió bien "introduce": repítela despacio.',
    words: [
      { text: 'Hi,', ok: true, hint_es: null },
      { text: 'introduce', ok: false, hint_es: 'Repite despacio: "introduce"' }
    ]
  },
  audio: { base64: 'SUQz', mime_type: 'audio/mpeg' }
}

let servidores
let urlBase

beforeAll(async () => {
  servidores = await iniciarServidor(0) // puerto libre aleatorio
  urlBase = `ws://localhost:${servidores.servidorHttp.address().port}/tiempo-real`
})

afterAll(async () => {
  await detenerServidor(servidores)
})

beforeEach(() => {
  sesionesActivas.clear()
  sesionesActivas.set('abc', { usuarioId: 1, creadaEn: Date.now() })
  sesionesActivas.set('xyz', { usuarioId: 1, creadaEn: Date.now() })
  sesionesActivas.set('de-otro', { usuarioId: 99, creadaEn: Date.now() })
  servicioTutorIa.procesarAudio.mockReset()
})

// Abre un socket y entrega una función para esperar el siguiente mensaje JSON
function conectar (query) {
  const socket = new WebSocket(`${urlBase}${query}`)
  const cola = []
  const esperando = []

  socket.on('message', (datos) => {
    const mensaje = JSON.parse(datos.toString())
    const resolver = esperando.shift()
    if (resolver) resolver(mensaje)
    else cola.push(mensaje)
  })

  const recibir = () => cola.length > 0
    ? Promise.resolve(cola.shift())
    : new Promise((resolve) => esperando.push(resolve))

  return { socket, recibir }
}

// Inicia un turno, envía audio y lo cierra
async function enviarTurno (socket, recibir, trozos) {
  socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
  expect((await recibir()).tipo).toBe('turno_iniciado')
  trozos.forEach((trozo) => socket.send(trozo))
  socket.send(JSON.stringify({ tipo: 'fin_turno' }))
  expect((await recibir()).tipo).toBe('procesando')
  return recibir()
}

describe('WebSocket /tiempo-real', () => {
  test('rechaza conexiones sin token', async () => {
    const { socket, recibir } = conectar('?sesion=abc')
    expect((await recibir()).codigo).toBe('TOKEN_INVALIDO')
    await new Promise((resolve) => socket.on('close', resolve))
  })

  test('rechaza conexiones con token falso', async () => {
    const { socket, recibir } = conectar('?sesion=abc&token=falso')
    expect((await recibir()).codigo).toBe('TOKEN_INVALIDO')
    await new Promise((resolve) => socket.on('close', resolve))
  })

  test('rechaza conexiones sin sesión', async () => {
    const { socket, recibir } = conectar(`?token=${token}`)
    const mensaje = await recibir()
    expect(mensaje.codigo).toBe('SESION_REQUERIDA')
    await new Promise((resolve) => socket.on('close', resolve))
  })

  test('rechaza sesiones que no existen o que son de otro estudiante', async () => {
    for (const sesion of ['no-existe', 'de-otro']) {
      const { socket, recibir } = conectar(`?sesion=${sesion}&token=${token}`)
      expect((await recibir()).codigo).toBe('SESION_NO_ENCONTRADA')
      await new Promise((resolve) => socket.on('close', resolve))
    }
  })

  test('un turno completo de audio devuelve resultado_turno con la respuesta hablada de Thommy', async () => {
    servicioTutorIa.procesarAudio.mockResolvedValue(TURNO_IA)
    const { socket, recibir } = conectar(`?sesion=abc&token=${token}`)
    expect(await recibir()).toEqual({ tipo: 'conectado', sesionId: 'abc' })

    const resultado = await enviarTurno(socket, recibir, [Buffer.alloc(1000), Buffer.alloc(500)])

    // El backend envía a la IA el audio completo del turno, con el id de la sesión
    const [{ sesionIa, audio }] = servicioTutorIa.procesarAudio.mock.calls[0]
    expect(sesionIa).toBe('abc')
    expect(audio.length).toBe(1500)

    expect(resultado).toEqual({
      tipo: 'resultado_turno',
      transcripcion: 'Hi, let me in produce myself.',
      evaluacion: {
        tipo: 'frase',
        etiqueta: 'Palabras entendidas',
        puntaje: 80,
        nivel: 'bien',
        mensaje: 'Casi perfecto. Thommy no entendió bien "introduce": repítela despacio.',
        palabras: [
          { texto: 'Hi,', correcta: true },
          { texto: 'introduce', correcta: false, sugerencia: 'Repite despacio: "introduce"' }
        ]
      },
      respuesta: {
        texto: 'Good job! Almost perfect! Listen and say it slowly:',
        frase: 'Hi, let me introduce myself.',
        audioUrl: 'data:audio/mpeg;base64,SUQz'
      }
    })
    socket.close()
  })

  test('los errores de la IA llegan a la app con su código', async () => {
    servicioTutorIa.procesarAudio.mockRejectedValue(crearError(422, 'AUDIO_NO_ENTENDIDO'))
    const { socket, recibir } = conectar(`?sesion=abc&token=${token}`)
    await recibir() // conectado
    expect(await enviarTurno(socket, recibir, [Buffer.alloc(100)])).toEqual({ tipo: 'error', codigo: 'AUDIO_NO_ENTENDIDO' })

    servicioTutorIa.procesarAudio.mockRejectedValue(new Error('fallo inesperado'))
    expect((await enviarTurno(socket, recibir, [Buffer.alloc(100)])).codigo).toBe('ERROR_PROCESAMIENTO')
    socket.close()
  })

  test('reporta errores de protocolo', async () => {
    const { socket, recibir } = conectar(`?sesion=xyz&token=${token}`)
    await recibir() // conectado

    socket.send(Buffer.alloc(10))
    expect((await recibir()).codigo).toBe('TURNO_NO_INICIADO')

    socket.send(JSON.stringify({ tipo: 'fin_turno' }))
    expect((await recibir()).codigo).toBe('TURNO_NO_INICIADO')

    socket.send('esto no es json')
    expect((await recibir()).codigo).toBe('JSON_INVALIDO')

    socket.send(JSON.stringify({ tipo: 'otra_cosa' }))
    expect((await recibir()).codigo).toBe('TIPO_DESCONOCIDO')

    socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
    await recibir()
    socket.send(JSON.stringify({ tipo: 'fin_turno' }))
    expect((await recibir()).codigo).toBe('AUDIO_VACIO')

    socket.close()
  })
})
