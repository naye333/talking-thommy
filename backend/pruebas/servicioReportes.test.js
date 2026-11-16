const reportes = require('../src/servicios/servicioReportes')

const AHORA = new Date('2026-11-16T12:00:00')
const DIA = 24 * 60 * 60 * 1000

function resultado ({ diasAtras, puntaje, tema = 'Introducing yourself', palabras = [], errores = [] }) {
  return {
    estudianteId: 1,
    temaTitulo: tema,
    creadoEn: new Date(AHORA.getTime() - diasAtras * DIA),
    puntajes: { pronunciacion: puntaje, vocabulario: puntaje, gramatica: puntaje, fluidez: puntaje },
    palabras,
    errores
  }
}

describe('servicioReportes', () => {
  test('normaliza el periodo', () => {
    expect(reportes.normalizarPeriodo('semestre')).toBe('semestre')
    expect(reportes.normalizarPeriodo('otro')).toBe('ultimo_mes')
  })

  test('calcula rangos del semestre desde julio', () => {
    const rangos = reportes.calcularRangos('semestre', AHORA)
    expect(rangos.actual.desde).toEqual(new Date(2026, 6, 1))
    expect(reportes.fechaInicialConsulta(rangos)).toEqual(new Date(2026, 6, 1))
  })

  test('reporte: promedio, variación y áreas del periodo', () => {
    const resultados = [
      resultado({ diasAtras: 40, puntaje: 50 }), // mes anterior
      resultado({ diasAtras: 10, puntaje: 70 }),
      resultado({ diasAtras: 2, puntaje: 90 })
    ]
    const reporte = reportes.construirReporte(resultados, 'ultimo_mes', AHORA)
    expect(reporte).toMatchObject({ periodo: 'ultimo_mes', promedioGeneral: 80, variacion: 30, totalTurnos: 2 })
    expect(reporte.areas).toEqual([
      { clave: 'pronunciacion', nombre: 'Pronunciación', valor: 80 },
      { clave: 'vocabulario', nombre: 'Vocabulario', valor: 80 },
      { clave: 'gramatica', nombre: 'Gramática', valor: 80 },
      { clave: 'fluidez', nombre: 'Fluidez', valor: 80 }
    ])
  })

  test('sin datos todo queda en 0 y sin variación', () => {
    const reporte = reportes.construirReporte([], 'ultima_semana', AHORA)
    expect(reporte).toMatchObject({ promedioGeneral: 0, variacion: 0, totalTurnos: 0 })
    const detalle = reportes.construirDetalle([], 'ultima_semana', AHORA)
    expect(detalle.evolucion).toHaveLength(7)
    expect(detalle.fortalezas).toEqual([])
    expect(detalle.areasMejorar).toEqual([])
  })

  test('detalle: evolución de 7 puntos con etiquetas y valores arrastrados', () => {
    const resultados = [resultado({ diasAtras: 20, puntaje: 60 }), resultado({ diasAtras: 1, puntaje: 80 })]
    const { evolucion, fortalezas, areasMejorar } = reportes.construirDetalle(resultados, 'ultimo_mes', AHORA)
    expect(evolucion.map((punto) => punto.etiqueta)).toEqual(['Sem 1', null, 'Sem 2', null, 'Sem 3', null, 'Sem 4'])
    expect(evolucion[0].valor).toBe(60)
    expect(evolucion[6].valor).toBe(80)
    expect(fortalezas).toEqual([])
    expect(areasMejorar).toHaveLength(1) // siempre sugiere un área si ninguna es fortaleza

    const semana = reportes.construirDetalle([resultado({ diasAtras: 1, puntaje: 90 })], 'ultima_semana', AHORA)
    expect(semana.evolucion[1].etiqueta).toBeNull()
    expect(semana.fortalezas).toContain('Buen desempeño en Pronunciación')

    const semestre = reportes.construirDetalle([resultado({ diasAtras: 1, puntaje: 50 })], 'semestre', AHORA)
    expect(semestre.evolucion[3].etiqueta).toBe('Corte 2')
    expect(semestre.areasMejorar).toEqual(['Pronunciación', 'Vocabulario', 'Gramática', 'Fluidez'])
  })

  test('falencias: tema más bajo por área y descripción', () => {
    const resultados = [
      resultado({ diasAtras: 3, puntaje: 90, tema: 'The alphabet and spelling' }),
      resultado({
        diasAtras: 2,
        puntaje: 40,
        palabras: [{ texto: 'introduce', correcta: false }, { texto: 'Hi,', correcta: true }],
        errores: [{ tipo: 'gramatica', explicacion: 'Falta "am".' }]
      }),
      resultado({ diasAtras: 1, puntaje: 60, tema: null })
    ]
    const falencias = reportes.calcularFalencias(resultados)
    const pronunciacion = falencias.find((falencia) => falencia.clave === 'pronunciacion')
    expect(pronunciacion).toMatchObject({ tema: 'Introducing yourself', porcentaje: 63 })
    expect(pronunciacion.descripcion).toMatch(/"introduce"/)
    expect(falencias.find((falencia) => falencia.clave === 'gramatica').descripcion).toBe('Falta "am".')
    expect(falencias.find((falencia) => falencia.clave === 'vocabulario').descripcion).toMatch(/vocabulario/)
    expect(falencias.find((falencia) => falencia.clave === 'fluidez').descripcion).toMatch(/pausas/)

    expect(reportes.calcularFalencias([])).toEqual([])
    expect(reportes.calcularFalencias([resultado({ diasAtras: 1, puntaje: 40 })])[0].descripcion).toMatch(/./)
  })

  test('sugiere recomendaciones para áreas bajas', () => {
    const sugerencias = reportes.sugerirRecomendaciones([
      { clave: 'gramatica', tema: 'Be', porcentaje: 50 },
      { clave: 'fluidez', tema: 'Intro', porcentaje: 90 }
    ])
    expect(sugerencias).toEqual(['Practicar la gramática de "Be"'])
  })

  test('alertas por promedio bajo o por bajar', () => {
    expect(reportes.construirAlerta({ totalTurnos: 0, promedioGeneral: 0, variacion: 0 })).toBeNull()
    expect(reportes.construirAlerta({ totalTurnos: 3, promedioGeneral: 60, variacion: 2 })).toBe('Promedio de 60%')
    expect(reportes.construirAlerta({ totalTurnos: 3, promedioGeneral: 80, variacion: -4 })).toBe('Bajó 4% este mes')
    expect(reportes.construirAlerta({ totalTurnos: 3, promedioGeneral: 80, variacion: 1 })).toBeNull()
    expect(reportes.resumirEstudiante([resultado({ diasAtras: 1, puntaje: 70 })], 'ultimo_mes', AHORA))
      .toEqual({ promedioGeneral: 70, variacion: 0, totalTurnos: 1 })
  })
})
