// Convierte los resultados del turno en la evaluación que ve el estudiante
const UMBRAL_EXCELENTE = 85
const UMBRAL_BIEN = 65
// Ritmo de referencia para A1-A2 (palabras por minuto) y pausa que se considera larga
const PALABRAS_POR_MINUTO_OBJETIVO = 90
const PAUSA_LARGA_SEG = 1.5

function clasificarNivel (puntaje) {
  if (puntaje >= UMBRAL_EXCELENTE) return 'excelente'
  if (puntaje >= UMBRAL_BIEN) return 'bien'
  return 'practicar'
}

// Fluidez 0-100 a partir del ritmo y de las pausas largas entre segmentos de Whisper
function calcularFluidez ({ texto, duracion, segmentos = [] }) {
  const cantidadPalabras = texto.split(/\s+/).filter(Boolean).length
  if (!duracion || cantidadPalabras === 0) return 0

  const palabrasPorMinuto = cantidadPalabras / (duracion / 60)
  let puntaje = Math.min(100, (palabrasPorMinuto / PALABRAS_POR_MINUTO_OBJETIVO) * 100)

  for (let i = 1; i < segmentos.length; i++) {
    if (segmentos[i].inicio - segmentos[i - 1].fin > PAUSA_LARGA_SEG) puntaje -= 10
  }
  return Math.max(0, Math.round(puntaje))
}

function quitarSignos (texto) {
  return texto.replace(/[^\w'-]/g, '')
}

function construirMensaje (nivel, palabras, errores) {
  const falladas = palabras.filter((palabra) => !palabra.correcta).map((palabra) => `"${quitarSignos(palabra.texto)}"`)
  let mensaje
  if (nivel === 'excelente') {
    mensaje = falladas.length === 0 ? '¡Excelente pronunciación!' : `¡Muy bien! Solo repasa ${falladas[0]}.`
  } else if (nivel === 'bien') {
    mensaje = `Bien hecho. Practica ${falladas.length > 1 ? 'las palabras' : 'la palabra'} ${falladas.slice(0, 2).join(' y ')}.`
  } else {
    mensaje = falladas.length > 0
      ? `Sigue practicando. Repite despacio: ${falladas.slice(0, 3).join(', ')}.`
      : 'Sigue practicando. Intenta decir la frase completa.'
  }
  const errorGramatical = errores.find((error) => error.explicacion)
  if (errorGramatical) mensaje += ` Ojo: ${errorGramatical.explicacion}`
  return mensaje
}

function construirEvaluacion ({ pronunciacion, errores }) {
  const nivel = clasificarNivel(pronunciacion.puntaje)
  return {
    puntaje: pronunciacion.puntaje,
    nivel,
    mensaje: construirMensaje(nivel, pronunciacion.palabras, errores),
    palabras: pronunciacion.palabras
  }
}

module.exports = { clasificarNivel, calcularFluidez, construirEvaluacion }
