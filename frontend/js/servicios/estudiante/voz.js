// Voz de Thommy. Si el servidor envía audio del tutor (respuesta.audioUrl) se reproduce ese audio;
// si no hay audio o no se puede reproducir, se leen los textos en inglés con la síntesis de voz del dispositivo.

let audioActual = null

export function vozDisponible () {
  return Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance)
}

// Thommy es un niño: se usa una voz masculina en inglés con el tono subido.
// Una voz masculina con tono alto suena a niño; una femenina con tono alto suena a señora aguda.
export const TONO_NINO = 1.7
const NOMBRES_MASCULINOS = /\b(david|mark|guy|andrew|brian|christopher|eric|roger|steffan|davis|tony|jason|alex|daniel|fred|aaron|tom|george|ryan|liam|james|william|thomas|oliver|male|hombre)\b/i

// Elige la mejor voz para Thommy: inglés de EE. UU. masculina local, luego cualquier masculina en inglés,
// luego cualquier voz en inglés. Las voces locales primero porque las de internet suelen ignorar el tono.
export function elegirVozThommy (voces) {
  const ingles = (voces || []).filter((voz) => /^en([-_]|$)/i.test(voz.lang || ''))
  const esMasculina = (voz) => NOMBRES_MASCULINOS.test(voz.name || '')
  const esEeUu = (voz) => /^en[-_]us$/i.test(voz.lang || '')
  const criterios = [
    (voz) => esMasculina(voz) && esEeUu(voz) && voz.localService,
    (voz) => esMasculina(voz) && voz.localService,
    (voz) => esMasculina(voz) && esEeUu(voz),
    esMasculina,
    esEeUu
  ]
  for (const criterio of criterios) {
    const voz = ingles.find(criterio)
    if (voz) return voz
  }
  return ingles[0] || null
}

// Chrome carga la lista de voces después de abrir la página: se pide de una vez para tenerla lista
if (vozDisponible()) {
  speechSynthesis.getVoices()
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices())
}

export function hablar (texto) {
  if (!vozDisponible() || !texto) return false
  speechSynthesis.cancel()
  const enunciado = new SpeechSynthesisUtterance(texto)
  const voz = elegirVozThommy(speechSynthesis.getVoices())
  if (voz) enunciado.voice = voz
  enunciado.lang = voz?.lang || 'en-US'
  enunciado.pitch = TONO_NINO
  enunciado.rate = 0.95
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
}
