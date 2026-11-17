// Migraciones y syllabus automáticos al arrancar, con una base de datos simulada
const mockConsultas = []
let mockAplicadas = []
let mockTemas = '0'
let mockFallaEn = null

jest.mock('../src/config/baseDatos', () => {
  const consultar = async (sql, parametros) => {
    mockConsultas.push(sql.trim().split('\n')[0])
    if (mockFallaEn && sql.includes(mockFallaEn)) throw new Error('error de sintaxis')
    if (sql.startsWith('SELECT nombre FROM migraciones_aplicadas')) return { rows: mockAplicadas.map((nombre) => ({ nombre })) }
    if (sql.includes('count(*) AS total FROM temas')) return { rows: [{ total: mockTemas }] }
    if (sql.includes('RETURNING id')) return { rows: [{ id: 1 }] }
    return { rows: [] }
  }
  const cliente = { query: consultar, release: () => {} }
  return {
    obtenerPool: () => ({ query: consultar, connect: async () => cliente }),
    cerrarPool: async () => {}
  }
})

const { ejecutarMigraciones, listarMigraciones } = require('../src/bd/migrar')
const { prepararBaseDatos } = require('../src/bd/prepararBaseDatos')

const silencio = () => {}

beforeEach(() => {
  mockConsultas.length = 0
  mockAplicadas = []
  mockTemas = '0'
  mockFallaEn = null
})

describe('migraciones automáticas', () => {
  test('aplica solo las pendientes, con candado', async () => {
    mockAplicadas = ['001_crear_usuarios.sql', '002_crear_syllabus.sql']
    const aplicadas = await ejecutarMigraciones({ log: silencio })
    expect(aplicadas).toEqual(listarMigraciones().slice(2))
    expect(mockConsultas[0]).toMatch(/pg_advisory_lock/)
    expect(mockConsultas.at(-1)).toMatch(/pg_advisory_unlock/)
  })

  test('si una migración falla, hace ROLLBACK y suelta el candado', async () => {
    mockFallaEn = 'codigo_grupo'
    await expect(ejecutarMigraciones({ log: silencio })).rejects.toThrow(/falló 004_codigo_grupo.sql/)
    expect(mockConsultas).toContain('ROLLBACK')
    expect(mockConsultas.at(-1)).toMatch(/pg_advisory_unlock/)
  })

  test('carga el syllabus solo si no hay temas', async () => {
    mockAplicadas = listarMigraciones()
    const vacia = await prepararBaseDatos({ log: silencio })
    expect(vacia).toEqual({ migraciones: [], sembroSyllabus: true })
    expect(mockConsultas.some((sql) => sql.startsWith('INSERT INTO temas'))).toBe(true)

    mockConsultas.length = 0
    mockTemas = '10'
    expect((await prepararBaseDatos({ log: silencio })).sembroSyllabus).toBe(false)
    expect(mockConsultas.some((sql) => sql.startsWith('INSERT INTO temas'))).toBe(false)
  })
})
