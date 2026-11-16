const WebSocket = require('ws')
const { iniciarServidor, detenerServidor } = require('../src/servidor')
const { generarToken } = require('../src/servicios/servicioAutenticacion')

const { crearError } = require('../src/utilidades/errores')

const token = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })

let servidores
let urlBase

// Sesiones simuladas: "abc" y "xyz" son del estudiante 1; cualquier otra no existe
async function cargarContexto (usuario, sesionId) {
  if (!['abc', 'xyz', 'lento', 'falla'].includes(sesionId)) throw crearError(404, 'SESION_NO_ENCONTRADA')
  return { sesion: { id: sesionId }, usuarioId: usuario.id, fraseActual: 'Nice to meet you.' }
}

// Procesador simulado: no llama a la IA
async function procesarTurno (audio, contexto) {
  if (contexto.sesion.id === 'falla') throw new Error('fallo inesperado')
  if (contexto.sesion.id === 'lento') await new Promise((resolve) => setTimeout(resolve, 150))
  return { tipo: 'resultado_turno', bytes: audio.length, frase: contexto.fraseActual }
}

beforeAll(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  servidores = await iniciarServidor(0, { cargarContexto, procesarTurno }) // puerto libre aleatorio
  urlBase = `ws://localhost:${servidores.servidorHttp.address().port}/tiempo-real`
})

afterAll(async () => {
  await detenerServidor(servidores)
  jest.restoreAllMocks()
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

  test('recibe un turno completo de audio', async () => {
    const { socket, recibir } = conectar(`?sesion=abc&token=${token}`)

    expect(await recibir()).toEqual({ tipo: 'conectado', sesionId: 'abc' })

    socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
    expect((await recibir()).tipo).toBe('turno_iniciado')

    socket.send(Buffer.alloc(1000))
    socket.send(Buffer.alloc(500))
    socket.send(JSON.stringify({ tipo: 'fin_turno' }))

    expect((await recibir()).tipo).toBe('procesando')
    expect(await recibir()).toEqual({ tipo: 'resultado_turno', bytes: 1500, frase: 'Nice to meet you.' })

    socket.close()
  })

  test('rechaza sesiones inexistentes o ajenas', async () => {
    const { socket, recibir } = conectar(`?sesion=999&token=${token}`)
    expect((await recibir()).codigo).toBe('SESION_NO_ENCONTRADA')
    await new Promise((resolve) => socket.on('close', resolve))
  })

  test('no procesa dos turnos a la vez', async () => {
    const { socket, recibir } = conectar(`?sesion=lento&token=${token}`)
    await recibir() // conectado

    const enviarTurno = () => {
      socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
      socket.send(Buffer.alloc(10))
      socket.send(JSON.stringify({ tipo: 'fin_turno' }))
    }
    enviarTurno()
    expect((await recibir()).tipo).toBe('turno_iniciado')
    expect((await recibir()).tipo).toBe('procesando')
    enviarTurno()
    expect((await recibir()).tipo).toBe('turno_iniciado')
    expect((await recibir()).codigo).toBe('TURNO_EN_PROCESO')
    expect((await recibir()).tipo).toBe('resultado_turno')

    socket.close()
  })

  test('responde ERROR_PROCESAMIENTO si el turno falla', async () => {
    const { socket, recibir } = conectar(`?sesion=falla&token=${token}`)
    await recibir() // conectado
    socket.send(JSON.stringify({ tipo: 'inicio_turno' }))
    socket.send(Buffer.alloc(10))
    socket.send(JSON.stringify({ tipo: 'fin_turno' }))
    await recibir() // turno_iniciado
    await recibir() // procesando
    expect((await recibir()).codigo).toBe('ERROR_PROCESAMIENTO')
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
