const {
  normalizarPalabra, obtenerFonemas, similitud, compararPronunciacion
} = require('../src/servicios/analisisFonetico')

describe('analisisFonetico', () => {
  test('normaliza palabras y obtiene fonemas sin acento', () => {
    expect(normalizarPalabra('Don’t,')).toBe("don't")
    expect(obtenerFonemas('hello')).toEqual(['HH', 'AH', 'L', 'OW'])
    expect(obtenerFonemas('zzqx')).toBeNull()
  })

  test('palabras que suenan igual tienen similitud 1', () => {
    expect(similitud('two', 'too')).toBe(1)
    expect(similitud('think', 'tink')).toBeGreaterThan(0.5)
    expect(similitud('think', 'tink')).toBeLessThan(1)
  })

  test('frase dicha igual obtiene 100 y todas las palabras correctas', () => {
    const resultado = compararPronunciacion('Nice to meet you.', 'nice to meet you')
    expect(resultado.puntaje).toBe(100)
    expect(resultado.palabras.every((palabra) => palabra.correcta)).toBe(true)
    expect(resultado.palabras[3].texto).toBe('you.') // conserva el texto original
  })

  test('localiza la desviación y da un consejo del sonido', () => {
    const resultado = compararPronunciacion('I think this is very good.', 'I tink dis is bery good')
    const think = resultado.palabras.find((palabra) => palabra.texto === 'think')
    expect(think).toMatchObject({ correcta: false, escuchado: 'tink' })
    expect(think.sugerencia).toMatch(/lengua entre los dientes/)
    expect(resultado.fonemasDificiles).toEqual(['TH', 'DH', 'V'])
    expect(resultado.puntaje).toBeLessThan(100)
  })

  test('marca palabras omitidas y penaliza las agregadas', () => {
    const omitida = compararPronunciacion('Where are you from?', 'where you from')
    expect(omitida.palabras[1]).toMatchObject({ texto: 'are', correcta: false })
    expect(omitida.palabras[1].sugerencia).toMatch(/No se escuchó "are"/)

    const agregada = compararPronunciacion('Nice to meet you.', 'nice nice to meet you')
    expect(agregada.puntaje).toBeLessThan(100)
  })

  test('une palabras que Whisper partió en dos', () => {
    const resultado = compararPronunciacion('Let me introduce myself.', 'let me introduce my self')
    expect(resultado.puntaje).toBe(100)
  })

  test('usa letras si la palabra no está en el diccionario', () => {
    const resultado = compararPronunciacion('My name is Xiomara.', 'my name is Siomara')
    expect(resultado.palabras[3].correcta).toBe(false)
    expect(resultado.palabras[3].sugerencia).toMatch(/Repite despacio/)
  })

  test('referencia vacía devuelve puntaje 0', () => {
    expect(compararPronunciacion('...', 'hello')).toEqual({ puntaje: 0, palabras: [], fonemasDificiles: [] })
  })
})
