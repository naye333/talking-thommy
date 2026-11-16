const { construirSaludo, construirMensajes, responderTurno } = require('../src/servicios/servicioTutor')

const tema = {
  titulo: 'Introducing yourself',
  objetivo: 'Presentarse',
  gramatica: ['Adjectives'],
  vocabulario: ['friendly', 'meet'],
  frasesModelo: ['Hi, let me introduce myself.', 'Nice to meet you.']
}

describe('servicioTutor', () => {
  test('saludo con tema propone la primera frase modelo', () => {
    expect(construirSaludo(tema)).toEqual({
      texto: 'Hi! I\'m Thommy. Today we will practice "Introducing yourself". Try saying this:',
      frase: 'Hi, let me introduce myself.'
    })
    expect(construirSaludo(null).frase).toBeNull()
  })

  test('los mensajes incluyen el syllabus, el historial y la frase pedida', () => {
    const mensajes = construirMensajes({
      tema,
      nivel: 1,
      historial: [{ transcripcion: 'hello', respuestaTutor: 'Hi!', fraseSiguiente: 'Nice to meet you.' }],
      transcripcion: 'nice to meet you',
      fraseObjetivo: 'Nice to meet you.'
    })
    expect(mensajes[0].content).toMatch(/Introducing yourself/)
    expect(mensajes[0].content).toMatch(/A1/)
    expect(mensajes).toHaveLength(4)
    expect(mensajes[3].content).toMatch(/asked to say: "Nice to meet you\."/)
    const libre = construirMensajes({ tema: null, nivel: 2, historial: [], transcripcion: 'hi' })[0].content
    expect(libre).toMatch(/free conversation/)
    expect(libre).toMatch(/A2/)
  })

  test('limpia la respuesta del modelo', async () => {
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
      frase: 'I am friendly.',
      correccion: 'I am Sara.',
      puntajeGramatica: 100,
      puntajeVocabulario: 100,
      errores: [{ tipo: 'gramatica', original: 'I Sara', correccion: 'I am Sara', explicacion: 'Falta "am".' }]
    })
  })

  test('usa valores seguros si el modelo responde incompleto', async () => {
    const resultado = await responderTurno({ tema: null, nivel: 1, transcripcion: 'hello' }, { completarJson: async () => ({ errores: 'no' }) })
    expect(resultado.respuesta).toMatch(/keep practicing/)
    expect(resultado.frase).toBeNull()
    expect(resultado.correccion).toBe('hello')
    expect(resultado.errores).toEqual([])
  })
})
