// Voz de Thommy. Si el servidor envía audio del tutor (respuesta.audioUrl) se reproduce ese audio;
// si no hay audio o no se puede reproducir, se leen los textos en inglés con la síntesis de voz del dispositivo.

let audioActual = null

export function vozDisponible () {
  return Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance)
}

export function hablar (texto) {
  if (!vozDisponible() || !texto) return false
  speechSynthesis.cancel()
  const enunciado = new SpeechSynthesisUtterance(texto)
  enunciado.lang = 'en-US'
  enunciado.rate = 0.9
  speechSynthesis.speak(enunciado)
  return true
}

// audioUrl puede ser absoluta o relativa a la API. Solo se aceptan http y https; si no es válida devuelve null.
export function resolverUrlAudio (audioUrl, urlBase) {
  if (typeof audioUrl !== 'string' || !audioUrl.trim()) return null
  try {
    const url = urlBase ? new URL(audioUrl, urlBase) : new URL(audioUrl)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

// Indica si hay algo que escuchar: el audio del servidor o la voz del dispositivo
export function puedeEscuchar ({ texto, audioUrl, urlBase }, { AudioImpl = globalThis.Audio } = {}) {
  const hayAudio = Boolean(AudioImpl && resolverUrlAudio(audioUrl, urlBase))
  return hayAudio || Boolean(vozDisponible() && texto)
}

// Reproduce el audio del tutor; si falta, falla al cargar o el dispositivo no lo deja reproducir, lee el texto
export function escucharThommy ({ texto, audioUrl, urlBase }, { AudioImpl = globalThis.Audio, leer = hablar } = {}) {
  callar()
  const url = AudioImpl ? resolverUrlAudio(audioUrl, urlBase) : null
  if (!url) return leer(texto)

  const audio = new AudioImpl(url)
  audioActual = audio
  // Solo usa el respaldo si este audio sigue siendo el actual (no se detuvo ni se reemplazó)
  const usarRespaldo = () => {
    if (audioActual !== audio) return
    audioActual = null
    leer(texto)
  }
  audio.addEventListener('error', usarRespaldo, { once: true })
  audio.addEventListener('ended', () => { if (audioActual === audio) audioActual = null }, { once: true })
  const reproduccion = audio.play()
  if (reproduccion && typeof reproduccion.catch === 'function') reproduccion.catch(usarRespaldo)
  return true
}

// Detiene el audio del tutor y la voz del dispositivo
export function callar () {
  if (audioActual) {
    const audio = audioActual
    audioActual = null
    audio.pause()
  }
  if (vozDisponible()) speechSynthesis.cancel()
}
