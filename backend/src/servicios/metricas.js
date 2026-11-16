// Métricas de calidad: tasa de error de palabras (WER) de la transcripción y percentiles de latencia
const { normalizarPalabra, alinear } = require('./analisisFonetico')

function palabrasDe (texto) {
  return texto.split(/\s+/).map(normalizarPalabra).filter(Boolean)
}

// WER = (sustituciones + omisiones + inserciones) / palabras de la referencia. 0 = perfecta.
function calcularWer (referencia, transcripcion) {
  const esperadas = palabrasDe(referencia)
  const dichas = palabrasDe(transcripcion)
  if (esperadas.length === 0) return dichas.length === 0 ? 0 : 1
  const { distancia } = alinear(esperadas, dichas, (a, b) => (a === b ? 0 : 1))
  return distancia / esperadas.length
}

// Percentil por el método del rango más cercano (p entre 0 y 100)
function percentil (valores, p) {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const posicion = Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1)
  return ordenados[posicion]
}

function promedio (valores) {
  return valores.length === 0 ? null : valores.reduce((suma, valor) => suma + valor, 0) / valores.length
}

module.exports = { calcularWer, percentil, promedio }
