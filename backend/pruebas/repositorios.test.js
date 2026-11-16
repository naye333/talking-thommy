// Verifica el mapeo de filas de PostgreSQL a objetos camelCase con un pool simulado
const mockConsultas = []
let mockRespuesta = { rows: [], rowCount: 0 }

jest.mock('../src/config/baseDatos', () => ({
  obtenerPool: () => ({ query: async (sql, parametros) => { mockConsultas.push({ sql, parametros }); return mockRespuesta } }),
  obtenerPoolObligatorio: () => ({ query: async (sql, parametros) => { mockConsultas.push({ sql, parametros }); return mockRespuesta } })
}))

const repositorioPractica = require('../src/repositorios/repositorioPractica')
const repositorioRecomendaciones = require('../src/repositorios/repositorioRecomendaciones')
const repositorioUsuarios = require('../src/repositorios/repositorioUsuarios')

beforeEach(() => {
  mockConsultas.length = 0
  mockRespuesta = { rows: [], rowCount: 0 }
})

describe('repositorioPractica', () => {
  test('crea y busca sesiones', async () => {
    mockRespuesta = { rows: [{ id: 1, estudiante_id: 2, tema_id: 3, frase_inicial: 'Hi', iniciada_en: 'fecha' }] }
    expect(await repositorioPractica.crearSesion({ estudianteId: 2, temaId: 3, fraseInicial: 'Hi' }))
      .toEqual({ id: 1, estudianteId: 2, temaId: 3, fraseInicial: 'Hi', iniciadaEn: 'fecha' })
    expect((await repositorioPractica.buscarSesionPorId(1)).estudianteId).toBe(2)
    mockRespuesta = { rows: [] }
    expect(await repositorioPractica.buscarSesionPorId(9)).toBeNull()
  })

  test('guarda resultados con JSON y lista turnos', async () => {
    mockRespuesta = { rows: [{ id: 5, creado_en: 'fecha' }] }
    await repositorioPractica.guardarResultadoTurno({
      sesionId: 1,
      transcripcion: 'hi',
      referencia: 'Hi',
      puntajes: { pronunciacion: 1, vocabulario: 2, gramatica: 3, fluidez: 4 },
      palabras: [{ texto: 'Hi', correcta: true }],
      errores: [],
      respuestaTutor: 'Hello',
      fraseSiguiente: null,
      latenciaMs: 900
    })
    expect(mockConsultas[0].parametros[7]).toBe('[{"texto":"Hi","correcta":true}]')

    mockRespuesta = { rows: [{ transcripcion: 'hi', respuesta_tutor: 'Hello', frase_siguiente: 'Bye' }] }
    expect(await repositorioPractica.listarUltimosTurnos(1, 3)).toEqual([{ transcripcion: 'hi', respuestaTutor: 'Hello', fraseSiguiente: 'Bye' }])

    mockRespuesta = {
      rows: [{
        estudiante_id: 2,
        tema_id: 3,
        tema_titulo: 'Intro',
        creado_en: '2026-11-01T00:00:00Z',
        puntaje_pronunciacion: 80,
        puntaje_vocabulario: 70,
        puntaje_gramatica: 60,
        puntaje_fluidez: 50,
        palabras: [],
        errores: []
      }]
    }
    const [resultado] = await repositorioPractica.listarResultados([2], new Date(), new Date())
    expect(resultado.creadoEn).toBeInstanceOf(Date)
    expect(resultado.puntajes).toEqual({ pronunciacion: 80, vocabulario: 70, gramatica: 60, fluidez: 50 })
  })
})

describe('repositorioRecomendaciones', () => {
  test('lista, crea, actualiza y elimina', async () => {
    mockRespuesta = { rows: [{ id: 1, texto: 'Leer', incluida: true, propia: false, docente_id: 9 }] }
    expect(await repositorioRecomendaciones.listar(2, 9)).toEqual([{ id: 1, texto: 'Leer', incluida: true, propia: false }])
    expect(await repositorioRecomendaciones.crear({ estudianteId: 2, docenteId: 9, texto: 'Leer', propia: false })).toMatchObject({ id: 1 })
    mockRespuesta = { rows: [] }
    expect(await repositorioRecomendaciones.actualizarIncluida({ id: 1, estudianteId: 2, docenteId: 9, incluida: false })).toBeNull()
    mockRespuesta = { rowCount: 1 }
    expect(await repositorioRecomendaciones.eliminar({ id: 1, estudianteId: 2, docenteId: 9 })).toBe(true)
  })
})

describe('repositorioUsuarios (docente)', () => {
  test('lista, busca y asigna estudiantes', async () => {
    mockRespuesta = { rows: [{ id: 1, nombre: 'Ana', nivel: 1 }] }
    expect(await repositorioUsuarios.listarEstudiantesDeDocente(9, 'an')).toEqual([{ id: 1, nombre: 'Ana', nivel: 1 }])
    expect(await repositorioUsuarios.buscarEstudianteDeDocente(9, 1)).toEqual({ id: 1, nombre: 'Ana', nivel: 1 })
    mockRespuesta = { rows: [] }
    expect(await repositorioUsuarios.buscarEstudianteDeDocente(9, 2)).toBeNull()
    mockRespuesta = { rowCount: 2 }
    expect(await repositorioUsuarios.asignarDocente(9, ['a@b.co', 'c@d.co'])).toBe(2)
    expect(mockConsultas.at(-1).parametros).toEqual([9, ['a@b.co', 'c@d.co']])
  })
})

describe('repositorioUsuarios (cuentas y grupos)', () => {
  test('actualiza contraseña, asigna docente y maneja el código de grupo', async () => {
    await repositorioUsuarios.actualizarContrasena(2, 'hash')
    await repositorioUsuarios.asignarDocentePorId(2, 9)
    expect(mockConsultas.at(-1).parametros).toEqual([2, 9])

    mockRespuesta = { rows: [{ id: 9, nombre: 'Profe' }] }
    expect(await repositorioUsuarios.buscarDocentePorCodigo('ABC234')).toEqual({ id: 9, nombre: 'Profe' })
    mockRespuesta = { rows: [{ codigo_grupo: 'ABC234' }] }
    expect(await repositorioUsuarios.obtenerCodigoGrupo(9)).toBe('ABC234')
    mockRespuesta = { rows: [] }
    expect(await repositorioUsuarios.obtenerCodigoGrupo(9)).toBeNull()
    expect(await repositorioUsuarios.buscarDocentePorCodigo('NADA')).toBeNull()
    expect(await repositorioUsuarios.actualizarCodigoGrupo(9, 'XYZ789')).toBe('XYZ789')
  })
})
