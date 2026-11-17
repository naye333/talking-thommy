const { explicarErrorBaseDatos, revisarConfiguracion, formatearProblema } = require('../src/config/diagnostico')

const base = {
  rutaEnv: '/x/backend/.env',
  urlBaseDatos: 'postgresql://u:c@host/db',
  groqApiKey: 'gsk_x',
  esProduccion: false,
  jwtSecreto: 'un-secreto-largo'
}
const existe = () => true
const noExiste = () => false

describe('diagnostico', () => {
  test('explica los errores de conexión más comunes', () => {
    expect(explicarErrorBaseDatos('password authentication failed for user "x"')).toMatch(/contraseña/)
    expect(explicarErrorBaseDatos('getaddrinfo ENOTFOUND ep-algo.neon.tech')).toMatch(/No se encuentra/)
    expect(explicarErrorBaseDatos('connect ETIMEDOUT')).toMatch(/5432/)
    expect(explicarErrorBaseDatos('database "x" does not exist')).toMatch(/npm run migrar/)
    expect(explicarErrorBaseDatos('Invalid URL')).toMatch(/postgresql:\/\//)
    expect(explicarErrorBaseDatos('otro error')).toBe('otro error')
    expect(explicarErrorBaseDatos()).toBe('')
  })

  test('sin problemas cuando todo está configurado', () => {
    expect(revisarConfiguracion(base, existe)).toEqual([])
    // En Render no hay .env, pero las variables llegan del panel: no es un problema
    expect(revisarConfiguracion(base, noExiste)).toEqual([])
  })

  test('sin .env ni DATABASE_URL reporta ambos errores', () => {
    const problemas = revisarConfiguracion({ ...base, urlBaseDatos: '' }, noExiste)
    expect(problemas.map((p) => p.gravedad)).toEqual(['error', 'error'])
    expect(problemas[0].mensaje).toMatch(/No existe el archivo/)
    expect(problemas[1].mensaje).toMatch(/Falta DATABASE_URL/)
  })

  test('detecta una DATABASE_URL mal copiada, falta de Groq y el secreto de desarrollo', () => {
    const problemas = revisarConfiguracion({ ...base, urlBaseDatos: '"postgresql://..."', groqApiKey: '', jwtSecreto: 'secreto-solo-para-desarrollo' }, existe)
    expect(problemas.map((p) => p.mensaje)).toEqual([
      expect.stringMatching(/no empieza por postgresql/),
      expect.stringMatching(/Falta GROQ_API_KEY/),
      expect.stringMatching(/JWT_SECRETO/)
    ])
    expect(formatearProblema(problemas[0])).toMatch(/^✘/)
    expect(formatearProblema(problemas[1])).toMatch(/^!/)
  })
})
