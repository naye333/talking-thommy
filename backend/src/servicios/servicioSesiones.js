// Sesiones de práctica con Thommy (docs/contrato-api-perfil-estudiante.md).
// Une el syllabus, el estudiante y el servicio de IA, y adapta sus respuestas al contrato de la app.
const servicioTutorIa = require('./servicioTutorIa')
const repositorioSyllabus = require('../repositorios/repositorioSyllabus')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const { crearError } = require('../utilidades/errores')

// Las sesiones activas viven en memoria: el servicio de IA guarda el historial de cada conversación.
// TODO (feature/progreso): guardar las sesiones y sus resultados en la base de datos para los reportes.
const DURACION_SESION_MS = 2 * 60 * 60 * 1000
const sesionesActivas = new Map() // id → { usuarioId, creadaEn }

function limpiarSesionesVencidas (ahora = Date.now()) {
  for (const [id, sesion] of sesionesActivas) {
    if (ahora - sesion.creadaEn > DURACION_SESION_MS) sesionesActivas.delete(id)
  }
}

// El audio va dentro del mensaje (data URI): no necesita otra petición, ni token, ni HTTPS aparte,
// y funciona igual en el navegador y en la app Android (https://localhost).
function convertirAudio (audio) {
  if (!audio?.base64) return null
  return `data:${audio.mime_type || 'audio/mpeg'};base64,${audio.base64}`
}

// Solo el primer nombre, para que Thommy salude de forma natural
async function obtenerPrimerNombre (usuarioId) {
  try {
    const usuario = await repositorioUsuarios.buscarPorId(usuarioId)
    return usuario?.nombre?.trim().split(/\s+/)[0] || null
  } catch {
    return null // sin base de datos también se puede conversar
  }
}

async function crearSesion ({ usuario, temaId }) {
  let tema = null
  if (temaId !== null && temaId !== undefined) {
    tema = await repositorioSyllabus.buscarTemaPorId(temaId)
    if (!tema) throw crearError(404, 'TEMA_NO_ENCONTRADO')
  }
  const nombre = await obtenerPrimerNombre(usuario.id)
  const inicio = await servicioTutorIa.iniciarSesion({ usuario, nombre, tema })

  limpiarSesionesVencidas()
  sesionesActivas.set(inicio.session_id, { usuarioId: usuario.id, creadaEn: Date.now() })

  return {
    sesion: { id: inicio.session_id },
    saludo: { texto: inicio.greeting, frase: inicio.phrase || null, audioUrl: convertirAudio(inicio.audio) }
  }
}

// Comprueba que la sesión exista y sea del estudiante (resuelve el TODO del WebSocket)
function verificarPropietario (sesionId, usuarioId) {
  const sesion = sesionesActivas.get(sesionId)
  if (!sesion || sesion.usuarioId !== usuarioId) throw crearError(404, 'SESION_NO_ENCONTRADA')
}

function convertirEvaluacion (evaluacion) {
  return {
    tipo: evaluacion.kind === 'phrase' ? 'frase' : 'gramatica',
    etiqueta: evaluacion.label_es,
    puntaje: evaluacion.score,
    nivel: evaluacion.level,
    mensaje: evaluacion.message_es,
    palabras: evaluacion.words.map((palabra) => palabra.ok
      ? { texto: palabra.text, correcta: true }
      : { texto: palabra.text, correcta: false, sugerencia: palabra.hint_es || undefined })
  }
}

// Turno completo: audio del estudiante → transcripción, evaluación y respuesta hablada de Thommy
async function procesarTurno ({ sesionId, usuarioId, audio }) {
  verificarPropietario(sesionId, usuarioId)
  const turno = await servicioTutorIa.procesarAudio({ sesionIa: sesionId, audio })
  const resultado = {
    tipo: 'resultado_turno',
    transcripcion: turno.transcription,
    evaluacion: convertirEvaluacion(turno.evaluation),
    respuesta: { texto: turno.reply, frase: turno.phrase || null, audioUrl: convertirAudio(turno.audio) }
  }
  if (turno.correction) {
    resultado.correccion = { original: turno.correction.original, corregida: turno.correction.corrected }
  }
  return resultado
}

module.exports = { crearSesion, procesarTurno, verificarPropietario, limpiarSesionesVencidas, sesionesActivas }
