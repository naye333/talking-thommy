// Voz de Thommy. Si el servidor envía audio del tutor (respuesta.audioUrl) se reproduce ese audio;
// si no hay audio o no se puede reproducir, se leen los textos en inglés con la síntesis de voz del dispositivo.
// alCambiar(hablando) avisa cuándo Thommy empieza y termina de hablar (para animar al avatar).

let audioActual = null
let avisarActual = null

const AUDIO_EMBEBIDO = /^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm|mp4|aac);base64,[A-Za-z0-9+/=]+$/

export function vozDisponible () {
  return Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance)
}

function avisar (hablando) {
  const funcion = avisarActual
  if (!hablando) avisarActual = null
  funcion?.(hablando)
}

export function hablar (texto, alTerminar) {
  if (!vozDisponible() || !texto) return false
  speechSynthesis.cancel()
  const enunciado = new SpeechSynthesisUtterance(texto)
  enunciado.lang = 'en-US'
  enunciado.rate = 0.9
  enunciado.pitch = 1.6 // más aguda, parecida a la voz infantil de Thommy
  if (alTerminar) {
    enunciado.onend = alTerminar
    enunciado.onerror = alTerminar
  }
  speechSynthesis.speak(enunciado)
  return true
}

// audioUrl puede ser absoluta, relativa a la API o un audio embebido (data:audio/...;base64).
// Solo se aceptan http, https y data:audio; si no es válida devuelve null.
export function resolverUrlAudio (audioUrl, urlBase) {
  if (typeof audioUrl !== 'string' || !audioUrl.trim()) return null
  if (audioUrl.startsWith('data:')) return AUDIO_EMBEBIDO.test(audioUrl) ? audioUrl : null
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
export function escucharThommy ({ texto, audioUrl, urlBase }, { AudioImpl = globalThis.Audio, leer = hablar, alCambiar } = {}) {
  callar()
  avisarActual = alCambiar || null
  const terminar = () => avisar(false)
  const leerTexto = () => {
    const leyo = leer(texto, terminar)
    if (leyo) avisar(true)
    else terminar()
    return leyo
  }

  const url = AudioImpl ? resolverUrlAudio(audioUrl, urlBase) : null
  if (!url) return leerTexto()

  const audio = new AudioImpl(url)
  audioActual = audio
  // Solo usa el respaldo si este audio sigue siendo el actual (no se detuvo ni se reemplazó)
  const usarRespaldo = () => {
    if (audioActual !== audio) return
    audioActual = null
    leerTexto()
  }
  audio.addEventListener('error', usarRespaldo, { once: true })
  audio.addEventListener('playing', () => { if (audioActual === audio) avisar(true) })
  audio.addEventListener('ended', () => {
    if (audioActual !== audio) return
    audioActual = null
    terminar()
  }, { once: true })
  // play() devuelve una promesa que se rechaza si el dispositivo bloquea la reproducción
  audio.play()?.catch(usarRespaldo)
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
  avisar(false)
}
