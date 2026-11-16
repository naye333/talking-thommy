// Análisis fonético: compara la frase de referencia con lo que el estudiante dijo (transcripción).
// Ambas se convierten a fonemas ARPAbet con el diccionario de pronunciación CMU y se alinean con
// distancia de edición. Así se localiza qué palabra se desvió y en qué sonido.
//
// Limitación conocida: solo se detectan desviaciones que hacen que Whisper escuche otra palabra
// (o ninguna). Una pronunciación con acento que Whisper igual reconoce cuenta como correcta.
const diccionarioCmu = require('cmu-pronouncing-dictionary')

// Consejos para los sonidos que más cuestan a hispanohablantes (clave: fonema esperado)
const CONSEJOS_FONEMA = {
  TH: 'el sonido "th" de "think": pon la punta de la lengua entre los dientes y sopla',
  DH: 'el sonido "th" de "this": lengua entre los dientes y haz vibrar la voz',
  V: 'la "v": apoya los dientes de arriba en el labio de abajo (no es una "b")',
  Z: 'la "z" inglesa: suena como una abeja, "zzz", con vibración',
  SH: 'el sonido "sh" de "she": labios hacia adelante, como pidiendo silencio',
  ZH: 'el sonido de "television": como "sh" pero con vibración',
  JH: 'el sonido "j" de "job": como una "ch" con vibración',
  HH: 'la "h" inglesa: es un soplo suave, no una "j" fuerte',
  IY: 'la "i" larga de "see": estira los labios y alárgala',
  IH: 'la "i" corta de "sit": más relajada y breve que la "i" española',
  AE: 'la vocal de "cat": abre la boca, entre una "a" y una "e"',
  AH: 'la vocal de "cup": una "a" corta y relajada',
  UH: 'la vocal de "book": una "u" corta y relajada',
  UW: 'la "u" larga de "food": redondea los labios y alárgala',
  ER: 'el sonido de "bird": lengua hacia atrás, sin vibrar la "r"',
  R: 'la "r" inglesa: no toques el paladar con la lengua',
  NG: 'el final "ng" de "sing": la parte de atrás de la lengua toca el paladar',
  W: 'la "w": labios redondos como para decir "u"'
}

const ESTRES = /[0-2]$/

// "Don't," → "don't"; descarta signos de puntuación
function normalizarPalabra (palabra) {
  return palabra.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '')
}

// Devuelve los fonemas sin marcas de acento, o null si la palabra no está en el diccionario
function obtenerFonemas (palabra) {
  const entrada = diccionarioCmu[normalizarPalabra(palabra)]
  if (!entrada) return null
  return entrada.split(' ').map((fonema) => fonema.replace(ESTRES, ''))
}

function separarPalabras (texto) {
  return texto.split(/\s+/)
    .map((original) => ({ original, normal: normalizarPalabra(original) }))
    .filter((palabra) => palabra.normal.length > 0)
}

// Whisper a veces parte una palabra en dos ("my self"): se unen si juntas forman una palabra esperada
function unirPalabrasPartidas (dichas, esperadas) {
  const normalesEsperadas = new Set(esperadas.map((palabra) => palabra.normal))
  const resultado = []
  for (let j = 0; j < dichas.length; j++) {
    const siguiente = dichas[j + 1]
    const unida = siguiente && dichas[j].normal + siguiente.normal
    if (unida && normalesEsperadas.has(unida) && !normalesEsperadas.has(dichas[j].normal)) {
      resultado.push({ original: `${dichas[j].original} ${siguiente.original}`, normal: unida })
      j++
    } else {
      resultado.push(dichas[j])
    }
  }
  return resultado
}

// Alineación por distancia de edición. Devuelve pares [i, j] (null = omisión o inserción).
function alinear (a, b, costoSustitucion) {
  const filas = a.length + 1
  const columnas = b.length + 1
  const costo = Array.from({ length: filas }, () => new Array(columnas).fill(0))
  for (let i = 0; i < filas; i++) costo[i][0] = i
  for (let j = 0; j < columnas; j++) costo[0][j] = j

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      costo[i][j] = Math.min(
        costo[i - 1][j] + 1,
        costo[i][j - 1] + 1,
        costo[i - 1][j - 1] + costoSustitucion(a[i - 1], b[j - 1])
      )
    }
  }

  const pares = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && costo[i][j] === costo[i - 1][j - 1] + costoSustitucion(a[i - 1], b[j - 1])) {
      pares.push([i - 1, j - 1])
      i--
      j--
    } else if (i > 0 && costo[i][j] === costo[i - 1][j] + 1) {
      pares.push([i - 1, null])
      i--
    } else {
      pares.push([null, j - 1])
      j--
    }
  }
  return { distancia: costo[a.length][b.length], pares: pares.reverse() }
}

const costoExacto = (x, y) => (x === y ? 0 : 1)

// Representación comparable de una palabra: fonemas si existen, si no sus letras
function unidadesDe (palabra) {
  return obtenerFonemas(palabra) || [...palabra]
}

// Similitud entre 0 y 1 de dos palabras según sus sonidos
function similitud (palabraA, palabraB) {
  if (palabraA === palabraB) return 1
  const fonemasA = obtenerFonemas(palabraA)
  const fonemasB = obtenerFonemas(palabraB)
  const [a, b] = fonemasA && fonemasB ? [fonemasA, fonemasB] : [[...palabraA], [...palabraB]]
  const { distancia } = alinear(a, b, costoExacto)
  return 1 - distancia / Math.max(a.length, b.length)
}

// Primer sonido esperado que no se produjo igual
function primerFonemaDesviado (esperada, escuchada) {
  const fonemasEsperados = obtenerFonemas(esperada)
  if (!fonemasEsperados) return null
  const { pares } = alinear(fonemasEsperados, unidadesDe(escuchada), costoExacto)
  const fonemasEscuchados = unidadesDe(escuchada)
  for (const [i, j] of pares) {
    if (i !== null && (j === null || fonemasEsperados[i] !== fonemasEscuchados[j])) return fonemasEsperados[i]
  }
  return null
}

function crearSugerencia (palabra, escuchada) {
  if (!escuchada) return `No se escuchó "${palabra.original.replace(/[^\w'-]/g, '')}". Repítela despacio.`
  const limpia = palabra.original.replace(/[^\w'-]/g, '')
  const fonema = primerFonemaDesviado(palabra.normal, escuchada.normal)
  const consejo = fonema && CONSEJOS_FONEMA[fonema]
  if (consejo) return `Se escuchó "${escuchada.normal}". En "${limpia}" cuida ${consejo}.`
  return `Se escuchó "${escuchada.normal}". Repite despacio: "${limpia}".`
}

// Compara la frase de referencia con la transcripción.
// Devuelve { puntaje 0-100, palabras: [{ texto, correcta, sugerencia?, escuchado? }], fonemasDificiles }
function compararPronunciacion (referencia, transcripcion) {
  const esperadas = separarPalabras(referencia)
  const dichas = unirPalabrasPartidas(separarPalabras(transcripcion), esperadas)
  if (esperadas.length === 0) return { puntaje: 0, palabras: [], fonemasDificiles: [] }

  const { pares } = alinear(esperadas, dichas, (a, b) => 1 - similitud(a.normal, b.normal))

  let suma = 0
  let insertadas = 0
  const palabras = []
  const fonemasDificiles = []

  for (const [i, j] of pares) {
    if (i === null) {
      insertadas++
      continue
    }
    const esperada = esperadas[i]
    const escuchada = j === null ? null : dichas[j]
    const parecido = escuchada ? similitud(esperada.normal, escuchada.normal) : 0
    suma += parecido

    if (parecido === 1) {
      palabras.push({ texto: esperada.original, correcta: true })
      continue
    }
    palabras.push({
      texto: esperada.original,
      correcta: false,
      sugerencia: crearSugerencia(esperada, escuchada),
      ...(escuchada ? { escuchado: escuchada.normal } : {})
    })
    const fonema = escuchada ? primerFonemaDesviado(esperada.normal, escuchada.normal) : null
    if (fonema) fonemasDificiles.push(fonema)
  }

  // Las palabras de más penalizan la mitad que una omisión
  const puntaje = Math.round((suma / (esperadas.length + insertadas * 0.5)) * 100)
  return { puntaje, palabras, fonemasDificiles }
}

module.exports = { normalizarPalabra, obtenerFonemas, alinear, similitud, compararPronunciacion, CONSEJOS_FONEMA }
