// npm run verificar con la base de datos y Groq simulados
let mockConexion = { estaConectada: true }
let mockFilas = {}

jest.mock('../src/config/baseDatos', () => ({
  verificarConexion: async () => mockConexion,
  cerrarPool: async () => {},
  obtenerPool: () => ({
    query: async (sql) => {
      const clave = Object.keys(mockFilas).find((parte) => sql.includes(parte))
      if (!clave || mockFilas[clave] instanceof Error) throw mockFilas[clave] || new Error('no existe')
      return { rows: mockFilas[clave] }
    }
  })
}))

const entorno = require('../src/config/entorno')
const { verificar } = require('../src/herramientas/verificarConfiguracion')
const { reiniciarEstadoIa } = require('../src/servicios/ia/estadoIa')
const modelosGroq = { data: [{ id: 'whisper-large-v3-turbo' }, { id: 'llama-3.3-70b-versatile' }] }

function ejecutar () {
  const lineas = []
  return verificar({ escribir: (texto) => lineas.push(texto) }).then((errores) => ({ errores, texto: lineas.join('\n') }))
}

describe('npm run verificar', () => {
  const original = { ...entorno }

  beforeEach(() => {
    Object.assign(entorno, { urlBaseDatos: 'postgresql://u:c@host/db', groqApiKey: 'gsk_x', jwtSecreto: 'secreto-largo' })
    mockConexion = { estaConectada: true }
    mockFilas = {
      migraciones_aplicadas: ['001_crear_usuarios.sql', '002_crear_syllabus.sql', '003_crear_practica_y_reportes.sql', '004_codigo_grupo.sql'].map((nombre) => ({ nombre })),
      'FROM temas': [{ total: '10' }],
      "rol = 'docente'": [{ total: '1' }]
    }
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => modelosGroq }))
    reiniciarEstadoIa()
  })

  afterEach(() => {
    Object.assign(entorno, original)
    delete global.fetch
  })

  test('todo listo', async () => {
    const { errores, texto } = await ejecutar()
    expect(errores).toBe(0)
    expect(texto).toMatch(/Syllabus cargado \(10 temas\)/)
    expect(texto).toMatch(/Groq listo/)
    expect(texto).toMatch(/Todo listo/)
  })

  test('migraciones pendientes, sin syllabus ni docentes', async () => {
    mockFilas.migraciones_aplicadas = [{ nombre: '001_crear_usuarios.sql' }]
    mockFilas['FROM temas'] = [{ total: '0' }]
    mockFilas["rol = 'docente'"] = new Error('sin tabla')
    const { errores, texto } = await ejecutar()
    expect(errores).toBe(3)
    expect(texto).toMatch(/Faltan migraciones: 002/)
    expect(texto).toMatch(/npm run sembrar-syllabus/)
    expect(texto).toMatch(/npm run crear-docente/)
  })

  test('sin tabla de migraciones las marca todas como pendientes', async () => {
    mockFilas.migraciones_aplicadas = new Error('no existe')
    const { texto } = await ejecutar()
    expect(texto).toMatch(/Faltan migraciones: 001/)
  })

  test('explica una conexión fallida y una clave de Groq rechazada', async () => {
    mockConexion = { estaConectada: false, motivo: 'password authentication failed' }
    global.fetch = jest.fn(async () => ({ ok: false, status: 401 }))
    const { errores, texto } = await ejecutar()
    expect(errores).toBe(2)
    expect(texto).toMatch(/La contraseña de DATABASE_URL no es correcta/)
    expect(texto).toMatch(/Groq rechazó GROQ_API_KEY/)
  })

  test('Groq caído o sin red', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }))
    expect((await ejecutar()).texto).toMatch(/Groq respondió con un error/)
    global.fetch = jest.fn(async () => { throw new Error('sin red') })
    expect((await ejecutar()).texto).toMatch(/No se pudo contactar a Groq/)
  })

  test('sin DATABASE_URL ni Groq solo muestra la configuración', async () => {
    Object.assign(entorno, { urlBaseDatos: '', groqApiKey: '' })
    const { errores, texto } = await ejecutar()
    expect(errores).toBeGreaterThanOrEqual(1)
    expect(texto).toMatch(/Falta DATABASE_URL/)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
