const entorno = require('../src/config/entorno')
const { detectarFormatoAudio, transcribirAudio, completarJson } = require('../src/servicios/ia/clienteGroq')

const audioWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])

function respuestaJson (cuerpo, estado = 200) {
  return { ok: estado < 400, status: estado, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) }
}

describe('clienteGroq', () => {
  const claveOriginal = entorno.groqApiKey

  beforeEach(() => {
    entorno.groqApiKey = 'clave-de-prueba'
    global.fetch = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    entorno.groqApiKey = claveOriginal
    delete global.fetch
    jest.restoreAllMocks()
  })

  test('detecta el formato del audio por sus primeros bytes', () => {
    expect(detectarFormatoAudio(audioWebm).extension).toBe('webm')
    expect(detectarFormatoAudio(Buffer.from('\0\0\0\x18ftypmp42')).extension).toBe('m4a')
    expect(detectarFormatoAudio(Buffer.from('OggS....')).extension).toBe('ogg')
    expect(detectarFormatoAudio(Buffer.from('RIFF....')).extension).toBe('wav')
    expect(detectarFormatoAudio(Buffer.from('ID3.....')).extension).toBe('mp3')
    expect(detectarFormatoAudio(Buffer.from('nada'))).toBeNull()
  })

  test('sin clave responde TUTOR_NO_DISPONIBLE', async () => {
    entorno.groqApiKey = ''
    await expect(transcribirAudio(audioWebm)).rejects.toMatchObject({ codigo: 'TUTOR_NO_DISPONIBLE' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('rechaza formatos de audio desconocidos', async () => {
    await expect(transcribirAudio(Buffer.from('nada'))).rejects.toMatchObject({ codigo: 'FORMATO_AUDIO_NO_SOPORTADO' })
  })

  test('transcribe con Whisper y devuelve segmentos', async () => {
    global.fetch.mockResolvedValue(respuestaJson({
      text: ' Nice to meet you. ', duration: 1.6, segments: [{ start: 0, end: 1.6, text: 'Nice to meet you.' }]
    }))
    const resultado = await transcribirAudio(audioWebm)

    expect(resultado).toEqual({ texto: 'Nice to meet you.', duracion: 1.6, segmentos: [{ inicio: 0, fin: 1.6, texto: 'Nice to meet you.' }] })
    const [url, opciones] = global.fetch.mock.calls[0]
    expect(url).toMatch(/\/audio\/transcriptions$/)
    expect(opciones.headers.Authorization).toBe('Bearer clave-de-prueba')
    expect(opciones.body.get('file').name).toBe('turno.webm')
    expect(opciones.body.get('language')).toBe('en')
  })

  test('completa en JSON con el modelo del tutor', async () => {
    global.fetch.mockResolvedValue(respuestaJson({ choices: [{ message: { content: '{"respuesta":"Hi!"}' } }] }))
    expect(await completarJson([{ role: 'user', content: 'hi' }])).toEqual({ respuesta: 'Hi!' })
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(cuerpo.response_format).toEqual({ type: 'json_object' })
  })

  test('traduce los errores de Groq a códigos propios', async () => {
    global.fetch.mockResolvedValueOnce(respuestaJson({ error: 'limite' }, 429))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_LIMITE_ALCANZADO' })

    global.fetch.mockResolvedValueOnce(respuestaJson({ error: 'clave' }, 401))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_CLAVE_INVALIDA' })

    global.fetch.mockResolvedValueOnce(respuestaJson({ error: 'caido' }, 500))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_NO_DISPONIBLE' })

    global.fetch.mockResolvedValueOnce(respuestaJson({ choices: [{ message: { content: 'no es json' } }] }))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_RESPUESTA_INVALIDA' })

    global.fetch.mockRejectedValueOnce(Object.assign(new Error('tarde'), { name: 'TimeoutError' }))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_TIEMPO_AGOTADO' })

    global.fetch.mockRejectedValueOnce(new Error('sin red'))
    await expect(completarJson([])).rejects.toMatchObject({ codigo: 'IA_NO_DISPONIBLE' })
  })
})
