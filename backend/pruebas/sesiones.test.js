const request = require('supertest')

jest.mock('../src/servicios/servicioTutorIa', () => ({
  iniciarSesion: jest.fn(),
  procesarAudio: jest.fn()
}))
jest.mock('../src/repositorios/repositorioSyllabus', () => ({
  buscarTemaPorId: async (id) => id === 3
    ? {
        id: 3,
        titulo: 'Introducing yourself',
        objetivo: 'Presentarse',
        gramatica: ['Adjectives'],
        vocabulario: ['introduce'],
        frasesModelo: ['Hi, let me introduce myself.']
      }
    : null
}))
jest.mock('../src/repositorios/repositorioUsuarios', () => ({
  buscarPorId: jest.fn(async () => ({ id: 1, nombre: 'Ana María Pérez' }))
}))

const servicioTutorIa = require('../src/servicios/servicioTutorIa')
const repositorioUsuarios = require('../src/repositorios/repositorioUsuarios')
const servicioSesiones = require('../src/servicios/servicioSesiones')
const { crearApp } = require('../src/app')
const { generarToken } = require('../src/servicios/servicioAutenticacion')
const { crearError } = require('../src/utilidades/errores')

const app = crearApp()
const tokenEstudiante = generarToken({ id: 1, rol: 'estudiante', nivel: 1 })
const tokenEstudianteNivel2 = generarToken({ id: 5, rol: 'estudiante', nivel: 2 })
const tokenDocente = generarToken({ id: 2, rol: 'docente', nivel: null })
const crearSesion = (cuerpo, token = tokenEstudiante) => request(app)
  .post('/api/sesiones').set('Authorization', `Bearer ${token}`).send(cuerpo)

const INICIO_IA = {
  session_id: 'a'.repeat(32),
  greeting: "Yay! Today we'll practice introducing yourself! Try saying this:",
  phrase: 'Hi, let me introduce myself.',
  audio: { base64: 'SUQz', mime_type: 'audio/mpeg' }
}

beforeEach(() => {
  servicioTutorIa.iniciarSesion.mockReset().mockResolvedValue(INICIO_IA)
  servicioSesiones.sesionesActivas.clear()
})

describe('POST /api/sesiones', () => {
  test('exige token y rol estudiante', async () => {
    expect((await request(app).post('/api/sesiones').send({})).status).toBe(401)
    expect((await crearSesion({}, tokenDocente)).status).toBe(403)
  })

  test('valida temaId', async () => {
    for (const temaId of ['3', 0, -1, 1.5]) {
      const respuesta = await crearSesion({ temaId })
      expect(respuesta.status).toBe(400)
      expect(respuesta.body.detalles[0].campo).toBe('temaId')
    }
  })

  test('404 si el tema no existe', async () => {
    const respuesta = await crearSesion({ temaId: 999 })
    expect(respuesta.status).toBe(404)
    expect(respuesta.body.error).toBe('TEMA_NO_ENCONTRADO')
  })

  test('con tema: Thommy saluda con la primera frase modelo y su voz', async () => {
    const respuesta = await crearSesion({ temaId: 3 })
    expect(respuesta.status).toBe(201)
    expect(respuesta.body).toEqual({
      sesion: { id: INICIO_IA.session_id },
      saludo: {
        texto: INICIO_IA.greeting,
        frase: 'Hi, let me introduce myself.',
        audioUrl: 'data:audio/mpeg;base64,SUQz'
      }
    })
    // A la IA le llega el tema del syllabus, el nivel MCER y solo el primer nombre
    const [{ usuario, nombre, tema }] = servicioTutorIa.iniciarSesion.mock.calls[0]
    expect(usuario.id).toBe(1)
    expect(nombre).toBe('Ana')
    expect(tema.frasesModelo).toEqual(['Hi, let me introduce myself.'])
    // La sesión queda registrada para el WebSocket
    expect(() => servicioSesiones.verificarPropietario(INICIO_IA.session_id, 1)).not.toThrow()
    expect(() => servicioSesiones.verificarPropietario(INICIO_IA.session_id, 2)).toThrow('SESION_NO_ENCONTRADA')
  })

  test('sin tema (temaId null o ausente): conversación libre', async () => {
    servicioTutorIa.iniciarSesion.mockResolvedValue({ ...INICIO_IA, phrase: null, audio: null })
    const respuesta = await crearSesion({ temaId: null }, tokenEstudianteNivel2)
    expect(respuesta.status).toBe(201)
    expect(respuesta.body.saludo).toEqual({ texto: INICIO_IA.greeting, frase: null, audioUrl: null })
    expect(servicioTutorIa.iniciarSesion.mock.calls[0][0].tema).toBeNull()
    expect((await crearSesion({})).status).toBe(201)
  })

  test('sin base de datos para el nombre, la conversación igual empieza', async () => {
    repositorioUsuarios.buscarPorId.mockRejectedValueOnce(crearError(503, 'BASE_DATOS_NO_DISPONIBLE'))
    expect((await crearSesion({})).status).toBe(201)
    expect(servicioTutorIa.iniciarSesion.mock.calls[0][0].nombre).toBeNull()
  })

  test('si la IA no responde, devuelve TUTOR_NO_DISPONIBLE', async () => {
    servicioTutorIa.iniciarSesion.mockRejectedValue(crearError(503, 'TUTOR_NO_DISPONIBLE'))
    const respuesta = await crearSesion({})
    expect(respuesta.status).toBe(503)
    expect(respuesta.body.error).toBe('TUTOR_NO_DISPONIBLE')
  })
})

describe('servicioSesiones', () => {
  test('incluye la corrección de gramática cuando la hay', async () => {
    servicioSesiones.sesionesActivas.set('s1', { usuarioId: 1, creadaEn: Date.now() })
    servicioTutorIa.procesarAudio.mockResolvedValue({
      transcription: 'Yesterday I go to school.',
      reply: 'Cool! Small tip: you can say, Yesterday I went to school. What did you do there?',
      phrase: null,
      correction: { original: 'Yesterday I go to school.', corrected: 'Yesterday I went to school.' },
      evaluation: { kind: 'grammar', label_es: 'Gramática', score: 80, level: 'bien', message_es: 'Se dice así', words: [{ text: 'go', ok: false, hint_es: null }] },
      audio: null
    })
    const resultado = await servicioSesiones.procesarTurno({ sesionId: 's1', usuarioId: 1, audio: Buffer.alloc(5) })
    expect(resultado.correccion).toEqual({ original: 'Yesterday I go to school.', corregida: 'Yesterday I went to school.' })
    expect(resultado.evaluacion.tipo).toBe('gramatica')
    expect(resultado.evaluacion.palabras).toEqual([{ texto: 'go', correcta: false, sugerencia: undefined }])
    expect(resultado.respuesta.audioUrl).toBeNull()
  })

  test('olvida las sesiones con más de 2 horas', () => {
    servicioSesiones.sesionesActivas.set('vieja', { usuarioId: 1, creadaEn: 0 })
    servicioSesiones.sesionesActivas.set('nueva', { usuarioId: 1, creadaEn: Date.now() })
    servicioSesiones.limpiarSesionesVencidas()
    expect([...servicioSesiones.sesionesActivas.keys()]).toEqual(['nueva'])
  })
})
