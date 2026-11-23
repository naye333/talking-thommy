const { construirSaludo, construirMensajes, responderTurno } = require('../src/servicios/servicioTutor')

const tema = {
  titulo: 'Introducing yourself',
  objetivo: 'Presentarse',
  gramatica: ['Adjectives'],
  vocabulario: ['friendly', 'meet'],
  frasesModelo: ['Hi, let me introduce myself.', 'Nice to meet you.']
}

describe('servicioTutor', () => {
  test('el saludo abre la conversación con una pregunta del tema, sin frase para repetir', () => {
    expect(construirSaludo({ ...tema, frasesModelo: ['Hi, let me introduce myself.', 'Where are you from?'] })).toEqual({
      texto: 'Hi! I\'m Thommy. Today let\'s talk about "Introducing yourself". Where are you from?',
      frase: null
    })
    // Si el tema no tiene preguntas modelo, usa una pregunta abierta
    expect(construirSaludo(tema).texto).toMatch(/What can you tell me about it\?$/)
    expect(construirSaludo(null)).toEqual({ texto: expect.stringMatching(/\?$/), frase: null })
  })

  test('los mensajes incluyen el syllabus, el saludo, el historial y piden conversar', () => {
    const mensajes = construirMensajes({
      tema,
      nivel: 1,
      historial: [{ transcripcion: 'hello', respuestaTutor: 'Hi! Where are you from?', fraseSiguiente: null }],
      transcripcion: 'I am from Bogota',
      saludo: 'Hi! I\'m Thommy. How are you?'
    })
    expect(mensajes[0].content).toMatch(/Introducing yourself/)
    expect(mensajes[0].content).toMatch(/A1/)
    expect(mensajes[0].content).toMatch(/Never ask the student to repeat/)
    expect(mensajes).toHaveLength(5)
    expect(JSON.parse(mensajes[1].content)).toEqual({ respuesta: 'Hi! I\'m Thommy. How are you?' })
    expect(mensajes[2]).toEqual({ role: 'user', content: 'hello' })
    expect(mensajes[4]).toEqual({ role: 'user', content: 'Student said: "I am from Bogota"' })
    const libre = construirMensajes({ tema: null, nivel: 2, historial: [], transcripcion: 'hi' })
    expect(libre).toHaveLength(2)
    expect(libre[0].content).toMatch(/free conversation/)
    expect(libre[0].content).toMatch(/A2/)
  })

  test('limpia la respuesta del modelo y nunca propone frases para repetir', async () => {
    const ia = {
      completarJson: async () => ({
        respuesta: 'Great job!',
        frase: 'I am friendly.',
        correccion: 'I am Sara.',
        puntajeGramatica: 140,
        errores: [
          { tipo: 'gramatica', original: 'I Sara', correccion: 'I am Sara', explicacion: 'Falta "am".' },
          { tipo: 'otro', original: 'x' },
          null
        ]
      })
    }
    const resultado = await responderTurno({ tema, nivel: 1, transcripcion: 'I Sara' }, ia)
    expect(resultado).toEqual({
      respuesta: 'Great job!',
      frase: null,
      correccion: 'I am Sara.',
      puntajeGramatica: 100,
      puntajeVocabulario: 100,
      errores: [{ tipo: 'gramatica', original: 'I Sara', correccion: 'I am Sara', explicacion: 'Falta "am".' }]
    })
  })

  test('usa valores seguros si el modelo responde incompleto', async () => {
    const resultado = await responderTurno({ tema: null, nivel: 1, transcripcion: 'hello' }, { completarJson: async () => ({ errores: 'no' }) })
    expect(resultado.respuesta).toMatch(/Tell me more/)
    expect(resultado.frase).toBeNull()
    expect(resultado.correccion).toBe('hello')
    expect(resultado.errores).toEqual([])
  })
})
