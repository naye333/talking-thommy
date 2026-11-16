// Cliente HTTP del servicio de IA con fetch simulado
const entorno = require('../src/config/entorno')
const servicioTutorIa = require('../src/servicios/servicioTutorIa')

const respuestaJson = (estado, cuerpo) => ({ ok: estado < 400, status: estado, json: async () => cuerpo })

afterEach(() => {
  jest.restoreAllMocks()
  entorno.claveServicioIa = ''
})

describe('servicioTutorIa', () => {
  test('iniciarSesion envía el nivel MCER, el nombre y el tema como "lesson"', async () => {
    const fetchSimulado = jest.spyOn(global, 'fetch').mockResolvedValue(respuestaJson(200, { session_id: 'x' }))
    const tema = { titulo: 'Introducing yourself', objetivo: 'Presentarse', gramatica: ['Adjectives'], vocabulario: ['meet'], frasesModelo: ['Nice to meet you.'] }

    await servicioTutorIa.iniciarSesion({ usuario: { id: 7, nivel: 2 }, nombre: 'Ana', tema })

    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(url).toBe(`${entorno.urlServicioIa}/session/start`)
    expect(JSON.parse(opciones.body)).toEqual({
      student_id: 'usuario-7',
      level: 'A2',
      student_name: 'Ana',
      include_audio_base64: true,
      lesson: { title: 'Introducing yourself', objective: 'Presentarse', grammar: ['Adjectives'], vocabulary: ['meet'], model_phrases: ['Nice to meet you.'] }
    })
    expect(opciones.headers['X-API-Key']).toBeUndefined()
  })

  test('sin tema no envía "lesson" y usa A1 por defecto', async () => {
    const fetchSimulado = jest.spyOn(global, 'fetch').mockResolvedValue(respuestaJson(200, {}))
    await servicioTutorIa.iniciarSesion({ usuario: { id: 1, nivel: 1 }, nombre: null, tema: null })
    const cuerpo = JSON.parse(fetchSimulado.mock.calls[0][1].body)
    expect(cuerpo.level).toBe('A1')
    expect(cuerpo.lesson).toBeUndefined()
  })

  test('procesarAudio envía el audio como formulario y la clave si está configurada', async () => {
    entorno.claveServicioIa = 'secreta'
    const fetchSimulado = jest.spyOn(global, 'fetch').mockResolvedValue(respuestaJson(200, { reply: 'Hi' }))

    const resultado = await servicioTutorIa.procesarAudio({ sesionIa: 'abc', audio: Buffer.from('audio') })

    expect(resultado).toEqual({ reply: 'Hi' })
    const [url, opciones] = fetchSimulado.mock.calls[0]
    expect(url).toBe(`${entorno.urlServicioIa}/conversation/audio`)
    expect(opciones.headers['X-API-Key']).toBe('secreta')
    expect(opciones.body.get('session_id')).toBe('abc')
    expect(opciones.body.get('audio').size).toBe(5)
  })

  test('traduce los errores de la IA a los códigos de la app', async () => {
    const casos = [
      [422, { error: 'speech_not_recognized' }, 422, 'AUDIO_NO_ENTENDIDO'],
      [400, { error: 'invalid_audio' }, 400, 'AUDIO_INVALIDO'],
      [413, { error: 'audio_too_large' }, 400, 'AUDIO_INVALIDO'],
      [404, { error: 'session_not_found' }, 404, 'SESION_NO_ENCONTRADA'],
      [503, { error: 'engine_unavailable' }, 503, 'TUTOR_NO_DISPONIBLE'],
      [500, null, 503, 'TUTOR_NO_DISPONIBLE']
    ]
    jest.spyOn(console, 'error').mockImplementation(() => {})
    for (const [estadoIa, cuerpo, estado, codigo] of casos) {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(respuestaJson(estadoIa, cuerpo))
      await expect(servicioTutorIa.procesarAudio({ sesionIa: 's', audio: Buffer.alloc(1) }))
        .rejects.toMatchObject({ estado, codigo })
    }
  })

  test('si el servicio de IA no está encendido, responde TUTOR_NO_DISPONIBLE', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    await expect(servicioTutorIa.iniciarSesion({ usuario: { id: 1, nivel: 1 } }))
      .rejects.toMatchObject({ estado: 503, codigo: 'TUTOR_NO_DISPONIBLE' })
  })
})
