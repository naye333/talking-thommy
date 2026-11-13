const WebSocket = require('ws')
const { iniciarServidor, detenerServidor } = require('../src/servidor')
const { generarToken } = require('../src/servicios/servicioAutenticacion')

const token = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })

let servidores
let urlBase

beforeAll(async () => {
  servidores = await iniciarServidor(0) // puerto libre aleatorio
  urlBase = `ws://localhost:${servidores.servidorHttp.address().port}/tiempo-real`
})

afterAll(async () => {
  await detenerServidor(servidores)
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
    expect(await recibir()).toEqual({ tipo: 'turno_recibido', bytes: 1500, sesionId: 'abc' })

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
