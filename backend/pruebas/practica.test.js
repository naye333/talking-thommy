// Rutas de práctica: POST /api/sesiones, GET /api/estudiante/progreso y carga del contexto del WebSocket
const request = require('supertest')

jest.mock('../src/repositorios/repositorioSyllabus', () => ({
  buscarTemaPorId: async (id) => id === 3
    ? { id: 3, titulo: 'Introducing yourself', frasesModelo: ['Hi, let me introduce myself.'] }
    : null
}))

jest.mock('../src/repositorios/repositorioPractica', () => ({
  crearSesion: jest.fn(async ({ estudianteId, temaId, fraseInicial }) => ({ id: 11, estudianteId, temaId, fraseInicial })),
  buscarSesionPorId: jest.fn(async (id) => id === 11 ? { id: 11, estudianteId: 1, temaId: 3, fraseInicial: 'Hi, let me introduce myself.' } : null),
  listarUltimosTurnos: jest.fn(async () => []),
  listarResultados: jest.fn(async () => [{
    estudianteId: 1,
    temaTitulo: 'Introducing yourself',
    creadoEn: new Date(Date.now() - 60 * 60 * 1000),
    puntajes: { pronunciacion: 80, vocabulario: 70, gramatica: 60, fluidez: 90 },
    palabras: [],
    errores: []
  }])
}))

const repositorioPractica = require('../src/repositorios/repositorioPractica')
const { crearApp } = require('../src/app')
const { generarToken } = require('../src/servicios/servicioAutenticacion')
const { cargarContextoSesion } = require('../src/tiempo-real/contextoSesion')

const app = crearApp()
const estudiante = { id: 1, rol: 'estudiante', nivel: 1 }
const tokenEstudiante = generarToken(estudiante)
const tokenDocente = generarToken({ id: 2, rol: 'docente', nivel: null })
const conToken = (peticion, token) => peticion.set('Authorization', `Bearer ${token}`)

describe('POST /api/sesiones', () => {
  test('crea la sesión con el saludo del tema', async () => {
    const respuesta = await conToken(request(app).post('/api/sesiones').send({ temaId: 3 }), tokenEstudiante)
    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toEqual({
      sesion: { id: 11, temaId: 3 },
      saludo: {
        texto: 'Hi! I\'m Thommy. Today we will practice "Introducing yourself". Try saying this:',
        frase: 'Hi, let me introduce myself.'
      }
    })
    expect(repositorioPractica.crearSesion).toHaveBeenCalledWith({ estudianteId: 1, temaId: 3, fraseInicial: 'Hi, let me introduce myself.' })
  })

  test('sin tema es conversación libre', async () => {
    const respuesta = await conToken(request(app).post('/api/sesiones').send({}), tokenEstudiante)
    expect(respuesta.status).toBe(201)
    expect(respuesta.body.saludo.frase).toBeNull()
  })

  test('valida el tema', async () => {
    const invalido = await conToken(request(app).post('/api/sesiones').send({ temaId: 'abc' }), tokenEstudiante)
    expect(invalido.status).toBe(400)
    const inexistente = await conToken(request(app).post('/api/sesiones').send({ temaId: 99 }), tokenEstudiante)
    expect(inexistente.status).toBe(404)
    expect(inexistente.body.error).toBe('TEMA_NO_ENCONTRADO')
  })

  test('solo estudiantes', async () => {
    const respuesta = await conToken(request(app).post('/api/sesiones').send({}), tokenDocente)
    expect(respuesta.status).toBe(403)
  })
})

describe('GET /api/estudiante/progreso', () => {
  test('devuelve reporte y detalle del estudiante del token', async () => {
    const respuesta = await conToken(request(app).get('/api/estudiante/progreso?periodo=ultima_semana'), tokenEstudiante)
    expect(respuesta.status).toBe(200)
    expect(respuesta.body).toMatchObject({ periodo: 'ultima_semana', promedioGeneral: 75, variacion: 0, totalTurnos: 1 })
    expect(respuesta.body.areas).toHaveLength(4)
    expect(respuesta.body.evolucion).toHaveLength(7)
    expect(respuesta.body.fortalezas).toEqual(['Buen desempeño en Fluidez', 'Buen desempeño en Pronunciación'])
    expect(respuesta.body.areasMejorar).toEqual(['Gramática'])
    expect(repositorioPractica.listarResultados.mock.calls[0][0]).toEqual([1])
  })

  test('el docente no tiene progreso propio', async () => {
    const respuesta = await conToken(request(app).get('/api/estudiante/progreso'), tokenDocente)
    expect(respuesta.status).toBe(403)
  })
})

describe('cargarContextoSesion', () => {
  test('carga la sesión, el tema y la frase actual', async () => {
    const contexto = await cargarContextoSesion(estudiante, '11')
    expect(contexto).toMatchObject({ sesion: { id: 11 }, tema: { id: 3 }, nivel: 1, fraseActual: 'Hi, let me introduce myself.' })
  })

  test('al reconectarse retoma la última frase propuesta', async () => {
    repositorioPractica.listarUltimosTurnos.mockResolvedValueOnce([{ fraseSiguiente: 'Nice to meet you.' }])
    expect((await cargarContextoSesion(estudiante, '11')).fraseActual).toBe('Nice to meet you.')
  })

  test('rechaza sesiones ajenas, inválidas y docentes', async () => {
    await expect(cargarContextoSesion({ id: 5, rol: 'estudiante' }, '11')).rejects.toMatchObject({ codigo: 'SESION_NO_ENCONTRADA' })
    await expect(cargarContextoSesion(estudiante, 'abc')).rejects.toMatchObject({ codigo: 'SESION_NO_ENCONTRADA' })
    await expect(cargarContextoSesion({ id: 2, rol: 'docente' }, '11')).rejects.toMatchObject({ codigo: 'PERMISO_DENEGADO' })
  })
})
