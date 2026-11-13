// Graba el micrófono en trozos (MediaRecorder) y mide el volumen en vivo para la onda de audio.
import { ErrorApi } from '../../nucleo/clienteApi.js'

const TIPOS_PREFERIDOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function microfonoDisponible () {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder)
}

function traducirErrorMicrofono (error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'MICROFONO_DENEGADO'
  if (error?.name === 'NotFoundError') return 'MICROFONO_NO_ENCONTRADO'
  return 'MICROFONO_NO_DISPONIBLE'
}

// alRecibirTrozo(blob) se llama cada intervaloMs mientras se graba
export async function crearGrabadora ({ alRecibirTrozo, intervaloMs = 250 }) {
  if (!microfonoDisponible()) throw new ErrorApi({ codigo: 'MICROFONO_NO_DISPONIBLE' })

  let flujo
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (error) {
    throw new ErrorApi({ codigo: traducirErrorMicrofono(error) })
  }

  const tipo = TIPOS_PREFERIDOS.find((candidato) => MediaRecorder.isTypeSupported(candidato)) || ''
  const grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined)
  const ContextoAudio = window.AudioContext || window.webkitAudioContext
  const contexto = new ContextoAudio()
  const analizador = contexto.createAnalyser()
  analizador.fftSize = 256
  contexto.createMediaStreamSource(flujo).connect(analizador)
  const muestras = new Uint8Array(analizador.fftSize)

  grabador.ondataavailable = (evento) => {
    if (evento.data && evento.data.size > 0) alRecibirTrozo(evento.data)
  }

  return {
    tipo: grabador.mimeType || tipo,

    iniciar () {
      grabador.start(intervaloMs)
    },

    // Volumen actual entre 0 y 1
    nivel () {
      analizador.getByteTimeDomainData(muestras)
      let suma = 0
      for (const muestra of muestras) {
        const desviacion = (muestra - 128) / 128
        suma += desviacion * desviacion
      }
      return Math.min(1, Math.sqrt(suma / muestras.length) * 4)
    },

    // Termina la grabación; el último trozo llega antes de resolver
    detener () {
      return new Promise((resolve) => {
        if (grabador.state === 'inactive') return resolve()
        grabador.addEventListener('stop', () => resolve(), { once: true })
        grabador.stop()
      })
    },

    liberar () {
      try {
        if (grabador.state !== 'inactive') grabador.stop()
      } catch { /* ya detenido */ }
      flujo.getTracks().forEach((pista) => pista.stop())
      contexto.close().catch(() => {})
    }
  }
}
