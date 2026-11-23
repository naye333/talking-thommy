// Captcha propio, sin servicios externos: una imagen SVG con letras dibujadas a mano y ruido.
// Las letras son trazos (no texto), así un programa no puede leer la respuesta del código SVG.
// Cada captcha sirve una sola vez y vence a los 5 minutos. Se guarda solo en memoria.
const crypto = require('crypto')

// Sin 0/O, 1/I/L, B/8, S/5, G/6, Z/2, D, Q, V ni J para que no se confundan al leerlos
const GLIFOS = {
  2: [[0, 3, 2, 0, 8, 0, 10, 3, 10, 5, 0, 14, 10, 14]],
  3: [[0, 0, 10, 0, 4, 6, 8, 6, 10, 9, 10, 12, 8, 14, 0, 14]],
  4: [[8, 14, 8, 0, 0, 9, 10, 9]],
  7: [[0, 0, 10, 0, 3, 14]],
  9: [[10, 7, 2, 7, 0, 5, 0, 2, 2, 0, 8, 0, 10, 2, 10, 10, 7, 14, 1, 14]],
  A: [[0, 14, 5, 0, 10, 14], [2, 9, 8, 9]],
  C: [[10, 1, 8, 0, 2, 0, 0, 3, 0, 11, 2, 14, 8, 14, 10, 13]],
  E: [[10, 0, 0, 0, 0, 14, 10, 14], [0, 7, 7, 7]],
  F: [[10, 0, 0, 0, 0, 14], [0, 7, 7, 7]],
  H: [[0, 0, 0, 14], [10, 0, 10, 14], [0, 7, 10, 7]],
  K: [[0, 0, 0, 14], [10, 0, 0, 8], [3, 6, 10, 14]],
  M: [[0, 14, 0, 0, 5, 8, 10, 0, 10, 14]],
  N: [[0, 14, 0, 0, 10, 14, 10, 0]],
  P: [[0, 14, 0, 0, 8, 0, 10, 2, 10, 5, 8, 7, 0, 7]],
  R: [[0, 14, 0, 0, 8, 0, 10, 2, 10, 5, 8, 7, 0, 7], [5, 7, 10, 14]],
  T: [[0, 0, 10, 0], [5, 0, 5, 14]],
  U: [[0, 0, 0, 11, 2, 14, 8, 14, 10, 11, 10, 0]],
  W: [[0, 0, 2, 14, 5, 6, 8, 14, 10, 0]],
  X: [[0, 0, 10, 14], [10, 0, 0, 14]],
  Y: [[0, 0, 5, 7, 10, 0], [5, 7, 5, 14]]
}
const ALFABETO = Object.keys(GLIFOS)
const LONGITUD = 5
const ANCHO = 220
const ALTO = 70
const COLORES_LETRA = ['#1f2a5c', '#2b6b3f', '#7a2e6b', '#8a4b0f', '#1d5c73']
const COLORES_RUIDO = ['#9aa3c7', '#a7c4a0', '#c9a0bd', '#d0b38a', '#93bccb']

function aleatorio (minimo, maximo) {
  return minimo + (crypto.randomInt(1_000_000) / 1_000_000) * (maximo - minimo)
}

function elegir (lista) {
  return lista[crypto.randomInt(lista.length)]
}

function redondear (numero) {
  return Math.round(numero * 10) / 10
}

// Dibuja un carácter: cada punto se mueve un poco y la letra se gira y se escala al azar
function dibujarCaracter (caracter, indice) {
  const escala = aleatorio(2.3, 2.8)
  const centroX = 26 + indice * 40 + aleatorio(-4, 4)
  const centroY = ALTO / 2 + aleatorio(-5, 5)
  const angulo = aleatorio(-0.35, 0.35)
  const coseno = Math.cos(angulo)
  const seno = Math.sin(angulo)
  const color = elegir(COLORES_LETRA)

  const trazos = GLIFOS[caracter].map((puntos) => {
    const coordenadas = []
    for (let i = 0; i < puntos.length; i += 2) {
      const x = (puntos[i] - 5 + aleatorio(-0.7, 0.7)) * escala
      const y = (puntos[i + 1] - 7 + aleatorio(-0.7, 0.7)) * escala
      coordenadas.push(`${redondear(centroX + x * coseno - y * seno)},${redondear(centroY + x * seno + y * coseno)}`)
    }
    return `<polyline points="${coordenadas.join(' ')}" stroke="${color}" stroke-width="${redondear(aleatorio(2.6, 3.6))}"/>`
  })
  return trazos.join('')
}

function dibujarRuido () {
  const piezas = []
  for (let i = 0; i < 4; i++) {
    const inicioY = aleatorio(5, ALTO - 5)
    const finY = aleatorio(5, ALTO - 5)
    piezas.push(`<path d="M0,${redondear(inicioY)} C${redondear(aleatorio(40, 90))},${redondear(aleatorio(0, ALTO))} ${redondear(aleatorio(130, 180))},${redondear(aleatorio(0, ALTO))} ${ANCHO},${redondear(finY)}" stroke="${elegir(COLORES_RUIDO)}" stroke-width="${redondear(aleatorio(1.2, 2.4))}"/>`)
  }
  for (let i = 0; i < 35; i++) {
    piezas.push(`<circle cx="${redondear(aleatorio(0, ANCHO))}" cy="${redondear(aleatorio(0, ALTO))}" r="${redondear(aleatorio(0.8, 2))}" fill="${elegir(COLORES_RUIDO)}" stroke="none"/>`)
  }
  return piezas.join('')
}

function dibujarSvg (texto) {
  const letras = [...texto].map(dibujarCaracter).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">` +
    `<rect width="${ANCHO}" height="${ALTO}" fill="#f4f6fb"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${dibujarRuido()}${letras}</g></svg>`
}

function generarTexto () {
  let texto = ''
  for (let i = 0; i < LONGITUD; i++) texto += elegir(ALFABETO)
  return texto
}

function normalizarRespuesta (respuesta) {
  return typeof respuesta === 'string' ? respuesta.replace(/\s/g, '').toUpperCase() : ''
}

function crearServicioCaptcha ({ duracionMs = 5 * 60 * 1000, maximoGuardados = 5000, ahora = () => Date.now() } = {}) {
  const guardados = new Map()

  function limpiarVencidos () {
    const momento = ahora()
    for (const [id, captcha] of guardados) {
      if (captcha.expira <= momento) guardados.delete(id)
    }
    // Si alguien pide miles de captchas, se descartan los más viejos para no llenar la memoria
    while (guardados.size >= maximoGuardados) guardados.delete(guardados.keys().next().value)
  }

  return {
    // Devuelve { captchaId, imagen } donde imagen es un data URL listo para <img src>
    generar () {
      limpiarVencidos()
      const texto = generarTexto()
      const captchaId = crypto.randomUUID()
      guardados.set(captchaId, { texto, expira: ahora() + duracionMs })
      const imagen = `data:image/svg+xml;base64,${Buffer.from(dibujarSvg(texto)).toString('base64')}`
      return { captchaId, imagen }
    },

    // Se borra al primer intento, acierte o no: así no se puede probar letra por letra
    verificar (captchaId, respuesta) {
      const captcha = typeof captchaId === 'string' ? guardados.get(captchaId) : null
      if (!captcha) return false
      guardados.delete(captchaId)
      if (captcha.expira <= ahora()) return false
      return normalizarRespuesta(respuesta) === captcha.texto
    },

    // Solo para pruebas: permite conocer la respuesta sin leer la imagen
    respuestaDe (captchaId) {
      return guardados.get(captchaId)?.texto ?? null
    },

    cantidad () {
      return guardados.size
    }
  }
}

module.exports = { crearServicioCaptcha, ALFABETO, LONGITUD }
