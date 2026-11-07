const { arrancar } = require('../src/servidor')

describe('arrancar', () => {
  let salida

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
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
