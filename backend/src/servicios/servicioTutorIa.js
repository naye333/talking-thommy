// Cliente HTTP del servicio de IA (carpeta ia/: Whisper + Ollama + Piper, en Python).
// La app nunca llama a este servicio: siempre pasa por el backend.
const entorno = require('../config/entorno')
const { crearError } = require('../utilidades/errores')

// Inglés I → A1, Inglés II → A2
const NIVEL_MCER = { 1: 'A1', 2: 'A2' }

// Traduce los errores del servicio de IA a los códigos que la app ya conoce
function traducirErrorIa (estado, cuerpo) {
  const codigoIa = cuerpo?.error
  if (codigoIa === 'speech_not_recognized') return crearError(422, 'AUDIO_NO_ENTENDIDO')
  if (codigoIa === 'invalid_audio' || codigoIa === 'audio_too_large') return crearError(400, 'AUDIO_INVALIDO')
  if (codigoIa === 'session_not_found' || codigoIa === 'session_ended') return crearError(404, 'SESION_NO_ENCONTRADA')
  console.error('[ia] respuesta inesperada', estado, cuerpo)
  return crearError(503, 'TUTOR_NO_DISPONIBLE')
}

async function llamarIa (ruta, opciones) {
  const encabezados = { ...opciones.headers }
  if (entorno.claveServicioIa) encabezados['X-API-Key'] = entorno.claveServicioIa

  let respuesta
  try {
    respuesta = await fetch(`${entorno.urlServicioIa}${ruta}`, {
      ...opciones,
      headers: encabezados,
      signal: AbortSignal.timeout(entorno.tiempoMaximoIaMs)
    })
  } catch (error) {
    console.error('[ia] sin conexión con el servicio de IA:', error.message)
    throw crearError(503, 'TUTOR_NO_DISPONIBLE')
  }

  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw traducirErrorIa(respuesta.status, cuerpo)
  return cuerpo
}

// tema: el del syllabus (repositorioSyllabus.buscarTemaPorId) o null para conversación libre
function iniciarSesion ({ usuario, nombre, tema }) {
  const cuerpo = {
    student_id: `usuario-${usuario.id}`,
    level: NIVEL_MCER[usuario.nivel] || 'A1',
    student_name: nombre || null,
    include_audio_base64: true
  }
  if (tema) {
    cuerpo.lesson = {
      title: tema.titulo,
      objective: tema.objetivo || null,
      grammar: tema.gramatica || [],
      vocabulary: tema.vocabulario || [],
      model_phrases: tema.frasesModelo || []
    }
  }
  return llamarIa('/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  })
}

// audio: Buffer con la grabación del turno (webm/opus, mp4…). ffmpeg detecta el formato por su contenido.
function procesarAudio ({ sesionIa, audio }) {
  const formulario = new FormData()
  formulario.append('session_id', sesionIa)
  formulario.append('include_audio_base64', 'true')
  formulario.append('audio', new Blob([audio]), 'turno.webm')
  return llamarIa('/conversation/audio', { method: 'POST', body: formulario })
}

module.exports = { iniciarSesion, procesarAudio, NIVEL_MCER }
