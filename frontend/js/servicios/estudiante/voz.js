// Lee en voz alta los textos de Thommy en inglés con la síntesis de voz del dispositivo (si existe).
// Es solo del frontend; cuando el backend envíe audio del tutor (respuesta.audioUrl) se puede reproducir ese audio.

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

export function callar () {
  if (vozDisponible()) speechSynthesis.cancel()
}
