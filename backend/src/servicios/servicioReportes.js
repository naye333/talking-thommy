// Reportes de progreso calculados a partir de resultados_turno (no se guardan aparte).
// Lo usan el perfil del estudiante y el del docente, con el mismo cálculo.

const AREAS = [
  { clave: 'pronunciacion', nombre: 'Pronunciación' },
  { clave: 'vocabulario', nombre: 'Vocabulario' },
  { clave: 'gramatica', nombre: 'Gramática' },
  { clave: 'fluidez', nombre: 'Fluidez' }
]

const PERIODOS = ['ultima_semana', 'ultimo_mes', 'semestre']
const PERIODO_POR_DEFECTO = 'ultimo_mes'
const DIA_MS = 24 * 60 * 60 * 1000
const PUNTOS_EVOLUCION = 7
const UMBRAL_FORTALEZA = 75
const UMBRAL_MEJORAR = 65
// Criterio de alerta propuesto por el frontend: pendiente de validar con el profesor
const UMBRAL_ALERTA_PROMEDIO = 65
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function normalizarPeriodo (periodo) {
  return PERIODOS.includes(periodo) ? periodo : PERIODO_POR_DEFECTO
}

// Semestres académicos: enero-junio y julio-diciembre
function inicioSemestre (fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth() < 6 ? 0 : 6, 1)
}

// actual: rango del reporte. comparacion/anterior: rangos que se restan para la variación
function calcularRangos (periodo, ahora = new Date()) {
  const hasta = ahora
  if (periodo === 'semestre') {
    const desde = inicioSemestre(ahora)
    const ultimos30 = new Date(Math.max(desde.getTime(), hasta.getTime() - 30 * DIA_MS))
    return {
      actual: { desde, hasta },
      comparacion: { desde: ultimos30, hasta },
      anterior: { desde, hasta: new Date(Math.min(hasta.getTime(), desde.getTime() + 30 * DIA_MS)) }
    }
  }
  const dias = periodo === 'ultima_semana' ? 7 : 28
  const desde = new Date(hasta.getTime() - dias * DIA_MS)
  return {
    actual: { desde, hasta },
    comparacion: { desde, hasta },
    anterior: { desde: new Date(desde.getTime() - dias * DIA_MS), hasta: desde }
  }
}

// Fecha más antigua que hay que consultar para cubrir todos los rangos del periodo
function fechaInicialConsulta (rangos) {
  return new Date(Math.min(rangos.actual.desde, rangos.anterior.desde))
}

function promedio (valores) {
  if (valores.length === 0) return null
  return Math.round(valores.reduce((suma, valor) => suma + valor, 0) / valores.length)
}

function puntajeGeneral (resultado) {
  return AREAS.reduce((suma, area) => suma + resultado.puntajes[area.clave], 0) / AREAS.length
}

function filtrarRango (resultados, { desde, hasta }) {
  return resultados.filter((resultado) => resultado.creadoEn >= desde && resultado.creadoEn < hasta)
}

function calcularAreas (resultados) {
  return AREAS.map((area) => ({
    ...area,
    valor: promedio(resultados.map((resultado) => resultado.puntajes[area.clave])) ?? 0
  }))
}

function promedioGeneral (resultados) {
  return promedio(resultados.map(puntajeGeneral)) ?? 0
}

function calcularVariacion (resultados, rangos) {
  const actuales = filtrarRango(resultados, rangos.comparacion)
  const anteriores = filtrarRango(resultados, rangos.anterior)
  if (actuales.length === 0 || anteriores.length === 0) return 0
  return promedioGeneral(actuales) - promedioGeneral(anteriores)
}

function etiquetaEvolucion (periodo, indice, fecha) {
  if (periodo === 'ultima_semana') return indice % 2 === 0 ? DIAS_SEMANA[fecha.getDay()] : null
  if (periodo === 'ultimo_mes') return indice % 2 === 0 ? `Sem ${indice / 2 + 1}` : null
  return { 0: 'Corte 1', 3: 'Corte 2', 6: 'Corte 3' }[indice] ?? null
}

// 7 puntos repartidos en el periodo; un tramo sin práctica repite el valor anterior
function calcularEvolucion (resultados, periodo, { desde, hasta }) {
  const tramo = (hasta - desde) / PUNTOS_EVOLUCION
  const valores = []
  for (let indice = 0; indice < PUNTOS_EVOLUCION; indice++) {
    const inicio = new Date(desde.getTime() + tramo * indice)
    const fin = indice === PUNTOS_EVOLUCION - 1 ? new Date(hasta.getTime() + 1) : new Date(inicio.getTime() + tramo)
    const enTramo = filtrarRango(resultados, { desde: inicio, hasta: fin })
    valores.push({ etiqueta: etiquetaEvolucion(periodo, indice, inicio), valor: enTramo.length ? promedioGeneral(enTramo) : null })
  }
  const primerValor = valores.find((punto) => punto.valor !== null)?.valor ?? 0
  let anterior = primerValor
  return valores.map((punto) => {
    anterior = punto.valor ?? anterior
    return { etiqueta: punto.etiqueta, valor: anterior }
  })
}

function calcularFortalezasYMejoras (areas, hayDatos) {
  if (!hayDatos) return { fortalezas: [], areasMejorar: [] }
  const ordenadas = [...areas].sort((a, b) => a.valor - b.valor)
  const fortalezas = ordenadas.filter((area) => area.valor >= UMBRAL_FORTALEZA).reverse()
    .map((area) => `Buen desempeño en ${area.nombre}`)
  let areasMejorar = ordenadas.filter((area) => area.valor < UMBRAL_MEJORAR).map((area) => area.nombre)
  // Siempre se sugiere al menos un área para seguir practicando
  if (areasMejorar.length === 0 && ordenadas[0].valor < UMBRAL_FORTALEZA) areasMejorar = [ordenadas[0].nombre]
  return { fortalezas, areasMejorar }
}

function masFrecuentes (valores, cantidad) {
  const conteo = new Map()
  for (const valor of valores) conteo.set(valor, (conteo.get(valor) || 0) + 1)
  return [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, cantidad).map(([valor]) => valor)
}

function describirFalencia (clave, resultados) {
  if (clave === 'pronunciacion') {
    const palabras = masFrecuentes(resultados.flatMap((resultado) => resultado.palabras
      .filter((palabra) => !palabra.correcta)
      .map((palabra) => palabra.texto.toLowerCase().replace(/[^\w'-]/g, ''))), 3)
    return palabras.length
      ? `Tiene dificultad para pronunciar: ${palabras.map((palabra) => `"${palabra}"`).join(', ')}.`
      : 'Su pronunciación está por debajo de lo esperado en este tema.'
  }
  if (clave === 'fluidez') return 'Habla con pausas largas o a un ritmo lento.'
  const [explicacion] = masFrecuentes(resultados.flatMap((resultado) => resultado.errores
    .filter((error) => error.tipo === clave && error.explicacion)
    .map((error) => error.explicacion)), 1)
  return explicacion || `Comete errores de ${clave === 'gramatica' ? 'gramática' : 'vocabulario'} en este tema.`
}

// Por cada área: el tema donde peor le va. Ordenadas de menor a mayor porcentaje.
function calcularFalencias (resultados) {
  if (resultados.length === 0) return []
  return AREAS.map((area) => {
    const porTema = new Map()
    for (const resultado of resultados) {
      const tema = resultado.temaTitulo || 'Conversación libre'
      if (!porTema.has(tema)) porTema.set(tema, [])
      porTema.get(tema).push(resultado)
    }
    let peor = null
    for (const [tema, delTema] of porTema) {
      const valor = promedio(delTema.map((resultado) => resultado.puntajes[area.clave]))
      if (!peor || valor < peor.valor) peor = { tema, valor, resultados: delTema }
    }
    return {
      clave: area.clave,
      area: area.nombre,
      tema: peor.tema,
      descripcion: describirFalencia(area.clave, peor.resultados),
      porcentaje: promedio(resultados.map((resultado) => resultado.puntajes[area.clave]))
    }
  }).sort((a, b) => a.porcentaje - b.porcentaje)
}

const RECOMENDACION_POR_AREA = {
  pronunciacion: (tema) => `Repetir con Thommy las frases modelo de "${tema}"`,
  vocabulario: (tema) => `Repasar el vocabulario de "${tema}"`,
  gramatica: (tema) => `Practicar la gramática de "${tema}"`,
  fluidez: (tema) => `Practicar en voz alta "${tema}" sin pausas largas`
}

// Sugerencias iniciales para el docente a partir de las falencias más bajas
function sugerirRecomendaciones (falencias) {
  return falencias
    .filter((falencia) => falencia.porcentaje < UMBRAL_FORTALEZA)
    .slice(0, 3)
    .map((falencia) => RECOMENDACION_POR_AREA[falencia.clave](falencia.tema).slice(0, 140))
}

// Resumen para listas: promedio general del periodo y variación
function resumirEstudiante (resultados, periodo, ahora) {
  const rangos = calcularRangos(periodo, ahora)
  const enPeriodo = filtrarRango(resultados, rangos.actual)
  return {
    promedioGeneral: promedioGeneral(enPeriodo),
    variacion: calcularVariacion(resultados, rangos),
    totalTurnos: enPeriodo.length
  }
}

function construirReporte (resultados, periodo, ahora) {
  const rangos = calcularRangos(periodo, ahora)
  const enPeriodo = filtrarRango(resultados, rangos.actual)
  return {
    periodo,
    promedioGeneral: promedioGeneral(enPeriodo),
    variacion: calcularVariacion(resultados, rangos),
    totalTurnos: enPeriodo.length,
    areas: calcularAreas(enPeriodo)
  }
}

function construirDetalle (resultados, periodo, ahora) {
  const rangos = calcularRangos(periodo, ahora)
  const enPeriodo = filtrarRango(resultados, rangos.actual)
  return {
    periodo,
    evolucion: calcularEvolucion(enPeriodo, periodo, rangos.actual),
    ...calcularFortalezasYMejoras(calcularAreas(enPeriodo), enPeriodo.length > 0)
  }
}

function construirAlerta (resumen) {
  if (resumen.totalTurnos === 0) return null
  if (resumen.promedioGeneral < UMBRAL_ALERTA_PROMEDIO) return `Promedio de ${resumen.promedioGeneral}%`
  if (resumen.variacion < 0) return `Bajó ${Math.abs(resumen.variacion)}% este mes`
  return null
}

module.exports = {
  AREAS,
  PERIODOS,
  PERIODO_POR_DEFECTO,
  normalizarPeriodo,
  calcularRangos,
  fechaInicialConsulta,
  resumirEstudiante,
  construirReporte,
  construirDetalle,
  calcularFalencias,
  sugerirRecomendaciones,
  construirAlerta
}
