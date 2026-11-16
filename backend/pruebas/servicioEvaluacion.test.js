const { clasificarNivel, calcularFluidez, construirEvaluacion } = require('../src/servicios/servicioEvaluacion')

describe('servicioEvaluacion', () => {
  test('clasifica el puntaje', () => {
    expect(clasificarNivel(90)).toBe('excelente')
    expect(clasificarNivel(70)).toBe('bien')
    expect(clasificarNivel(40)).toBe('practicar')
  })

  test('calcula la fluidez por ritmo y pausas largas', () => {
    // 6 palabras en 4 s = 90 ppm → 100
    expect(calcularFluidez({ texto: 'one two three four five six', duracion: 4 })).toBe(100)
    const conPausa = calcularFluidez({
      texto: 'one two three four five six',
      duracion: 4,
      segmentos: [{ inicio: 0, fin: 1 }, { inicio: 3, fin: 4 }]
    })
    expect(conPausa).toBe(90)
    expect(calcularFluidez({ texto: '', duracion: 3 })).toBe(0)
    expect(calcularFluidez({ texto: 'hello', duracion: 0 })).toBe(0)
  })

  test('arma el mensaje según el nivel y agrega el error gramatical', () => {
    const palabras = [{ texto: 'Hi,', correcta: true }, { texto: 'introduce', correcta: false }]
    expect(construirEvaluacion({ pronunciacion: { puntaje: 100, palabras: [palabras[0]] }, errores: [] }).mensaje)
      .toBe('¡Excelente pronunciación!')
    expect(construirEvaluacion({ pronunciacion: { puntaje: 88, palabras }, errores: [] }).mensaje)
      .toBe('¡Muy bien! Solo repasa "introduce".')
    expect(construirEvaluacion({ pronunciacion: { puntaje: 70, palabras }, errores: [] }).mensaje)
      .toBe('Bien hecho. Practica la palabra "introduce".')

    const practicar = construirEvaluacion({
      pronunciacion: { puntaje: 30, palabras },
      errores: [{ tipo: 'gramatica', explicacion: 'Usa "am" con "I".' }]
    })
    expect(practicar).toMatchObject({ puntaje: 30, nivel: 'practicar', palabras })
    expect(practicar.mensaje).toBe('Sigue practicando. Repite despacio: "introduce". Ojo: Usa "am" con "I".')
    expect(construirEvaluacion({ pronunciacion: { puntaje: 0, palabras: [] }, errores: [] }).mensaje)
      .toMatch(/frase completa/)
  })
})
