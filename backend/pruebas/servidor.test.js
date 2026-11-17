const { arrancar } = require('../src/servidor')

describe('arrancar', () => {
  let salida

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    salida = jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    jest.restoreAllMocks()
  })

  test('inicia, registra el apagado y termina con código 0', async () => {
    const { servidores, apagar } = await arrancar(0)

    expect(servidores.servidorHttp.listening).toBe(true)
    expect(process.listeners('SIGINT')).toContain(apagar)
    expect(process.listeners('SIGTERM')).toContain(apagar)

    apagar()
    await new Promise((resolve) => servidores.servidorHttp.once('close', resolve))
    await new Promise((resolve) => setImmediate(resolve))
    expect(salida).toHaveBeenCalledWith(0)
  })
})

jest.mock('../src/bd/prepararBaseDatos', () => ({ prepararBaseDatos: jest.fn(async () => ({ migraciones: [], sembroSyllabus: false })) }))
jest.mock('../src/config/baseDatos', () => {
  const real = jest.requireActual('../src/config/baseDatos')
  return { ...real, verificarConexion: jest.fn(real.verificarConexion) }
})

describe('avisarConfiguracion', () => {
  const entorno = require('../src/config/entorno')
  const original = { ...entorno }
  const { avisarConfiguracion } = require('../src/servidor')

  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))
  afterEach(() => {
    Object.assign(entorno, original)
    jest.restoreAllMocks()
  })

  test('avisa lo que falta sin detener el servidor en desarrollo', async () => {
    Object.assign(entorno, { urlBaseDatos: '', esProduccion: false })
    await avisarConfiguracion()
    expect(console.warn.mock.calls.flat().join(' ')).toMatch(/Falta DATABASE_URL/)
  })

  test('en producción no arranca sin base de datos', async () => {
    Object.assign(entorno, { urlBaseDatos: '', esProduccion: true })
    await expect(avisarConfiguracion()).rejects.toThrow(/DATABASE_URL/)
  })

  test('explica por qué no se pudo conectar', async () => {
    Object.assign(entorno, { urlBaseDatos: 'postgresql://u:c@127.0.0.1:1/db', esProduccion: false })
    await avisarConfiguracion()
    expect(console.warn.mock.calls.flat().join(' ')).toMatch(/\[bd\] ✘ no se pudo conectar/)
    await require('../src/config/baseDatos').cerrarPool()
  })

  test('con conexión, prepara la base de datos (migraciones y syllabus)', async () => {
    const { prepararBaseDatos } = require('../src/bd/prepararBaseDatos')
    const baseDatos = require('../src/config/baseDatos')
    baseDatos.verificarConexion.mockResolvedValueOnce({ estaConectada: true })
    jest.spyOn(console, 'log').mockImplementation(() => {})
    Object.assign(entorno, { urlBaseDatos: 'postgresql://u:c@host/db', esProduccion: false, migrarAlArrancar: true })
    await avisarConfiguracion()
    expect(prepararBaseDatos).toHaveBeenCalled()

    // En desarrollo, si falla, solo avisa; en producción no arranca
    prepararBaseDatos.mockRejectedValueOnce(new Error('falló 004'))
    baseDatos.verificarConexion.mockResolvedValueOnce({ estaConectada: true })
    await avisarConfiguracion()
    expect(console.warn.mock.calls.flat().join(' ')).toMatch(/no se pudo preparar/)

    prepararBaseDatos.mockRejectedValueOnce(new Error('falló 004'))
    baseDatos.verificarConexion.mockResolvedValueOnce({ estaConectada: true })
    Object.assign(entorno, { esProduccion: true })
    await expect(avisarConfiguracion()).rejects.toThrow(/no se pudo preparar/)
  })

  test('con MIGRAR_AL_ARRANCAR=false no toca la base de datos', async () => {
    const { prepararBaseDatos } = require('../src/bd/prepararBaseDatos')
    prepararBaseDatos.mockClear()
    require('../src/config/baseDatos').verificarConexion.mockResolvedValueOnce({ estaConectada: true })
    jest.spyOn(console, 'log').mockImplementation(() => {})
    Object.assign(entorno, { urlBaseDatos: 'postgresql://u:c@host/db', esProduccion: false, migrarAlArrancar: false })
    await avisarConfiguracion()
    expect(prepararBaseDatos).not.toHaveBeenCalled()
  })
})
