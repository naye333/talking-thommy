const entorno = require('../src/config/entorno')
const { revisarIa, estadoIaReciente, reiniciarEstadoIa, elegirModelo } = require('../src/servicios/ia/estadoIa')
const { codigoSegunRespuesta, completarJson, transcribirAudio } = require('../src/servicios/ia/clienteGroq')

const respuesta = (estado, cuerpo) => ({ ok: estado < 400, status: estado, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) })
const modelos = (...ids) => respuesta(200, { data: ids.map((id) => ({ id })) })

describe('estado de la IA (Groq)', () => {
  const clave = entorno.groqApiKey

  beforeEach(() => {
    entorno.groqApiKey = 'gsk_prueba'
    reiniciarEstadoIa()
    global.fetch = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    entorno.groqApiKey = clave
    reiniciarEstadoIa()
    delete global.fetch
    jest.restoreAllMocks()
  })

  test('ok con los modelos configurados', async () => {
    global.fetch.mockResolvedValue(modelos('whisper-large-v3-turbo', 'llama-3.3-70b-versatile'))
    const estado = await revisarIa()
    expect(estado).toMatchObject({ estado: 'ok', modelos: { transcripcion: 'whisper-large-v3-turbo', tutor: 'llama-3.3-70b-versatile' } })
    expect(estado.reemplazados).toBeUndefined()
  })

  test('si Groq retiró un modelo, elige otro de la misma clase', async () => {
    global.fetch.mockResolvedValue(modelos('whisper-large-v3', 'openai/gpt-oss-120b', 'llama-guard-4'))
    const estado = await revisarIa()
    expect(estado).toMatchObject({ estado: 'ok', modelos: { transcripcion: 'whisper-large-v3', tutor: 'openai/gpt-oss-120b' }, reemplazados: ['transcripcion', 'tutor'] })
    expect(entorno.modeloTutor).toBe('openai/gpt-oss-120b')
    expect(elegirModelo('tutor', ['llama-guard-4', 'qwen/qwen3-32b'])).toBe('qwen/qwen3-32b')
    expect(elegirModelo('tutor', ['llama-guard-4'])).toBeNull()
  })

  test('explica clave inválida, sin modelos, error de Groq y sin conexión', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(401, {}))
    expect((await revisarIa({ forzar: true })).estado).toBe('clave_invalida')
    global.fetch.mockResolvedValueOnce(modelos('llama-guard-4'))
    expect((await revisarIa({ forzar: true })).estado).toBe('sin_modelo')
    global.fetch.mockResolvedValueOnce(respuesta(503, {}))
    expect(await revisarIa({ forzar: true })).toMatchObject({ estado: 'error_groq', codigoHttp: 503 })
    global.fetch.mockRejectedValueOnce(new Error('sin red'))
    expect((await revisarIa({ forzar: true })).estado).toBe('sin_conexion')
    entorno.groqApiKey = ''
    expect((await revisarIa({ forzar: true })).estado).toBe('sin_clave')
  })

  test('guarda el resultado unos minutos y /api/salud no espera a Groq', async () => {
    global.fetch.mockResolvedValue(modelos('whisper-large-v3-turbo', 'llama-3.3-70b-versatile'))
    expect(estadoIaReciente()).toEqual({ estado: 'revisando' })
    await revisarIa()
    expect(estadoIaReciente().estado).toBe('ok')
    await revisarIa()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('traduce las respuestas de Groq a códigos claros', () => {
    expect(codigoSegunRespuesta(401, '')).toBe('IA_CLAVE_INVALIDA')
    expect(codigoSegunRespuesta(429, '')).toBe('IA_LIMITE_ALCANZADO')
    expect(codigoSegunRespuesta(404, '')).toBe('IA_MODELO_NO_DISPONIBLE')
    expect(codigoSegunRespuesta(400, '{"error":{"code":"model_decommissioned"}}')).toBe('IA_MODELO_NO_DISPONIBLE')
    expect(codigoSegunRespuesta(500, 'otro')).toBe('IA_NO_DISPONIBLE')
  })

  test('si el modelo fue retirado, cambia de modelo y reintenta una vez', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(400, { error: { code: 'model_decommissioned' } }))
      .mockResolvedValueOnce(modelos('whisper-large-v3-turbo', 'openai/gpt-oss-20b'))
      .mockResolvedValueOnce(respuesta(200, { choices: [{ message: { content: '{"respuesta":"Hi"}' } }] }))
    expect(await completarJson([])).toEqual({ respuesta: 'Hi' })
    expect(JSON.parse(global.fetch.mock.calls[2][1].body).model).toBe('openai/gpt-oss-20b')
  })

  test('con la clave inválida no reintenta y responde IA_CLAVE_INVALIDA', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(401, { error: 'invalid_api_key' }))
    await expect(transcribirAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).rejects.toMatchObject({ codigo: 'IA_CLAVE_INVALIDA' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('si no hay otro modelo, no reintenta', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(404, {}))
      .mockResolvedValueOnce(modelos('llama-guard-4'))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_MODELO_NO_DISPONIBLE' })
  })
})
