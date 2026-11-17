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
})
