// Revisa que Groq funcione con la clave y los modelos configurados, sin gastar cuota (lista de modelos).
// Si un modelo configurado ya no existe (Groq retira modelos), elige uno disponible de la misma clase.
const entorno = require('../../config/entorno')

const VIGENCIA_MS = 5 * 60 * 1000
const MODELOS_CONFIGURADOS = { transcripcion: entorno.modeloTranscripcion, tutor: entorno.modeloTutor }
const PREFERIDOS = {
  transcripcion: ['whisper-large-v3-turbo', 'whisper-large-v3'],
  tutor: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct']
}
const ES_DE_CLASE = {
  transcripcion: (id) => /whisper/i.test(id),
  tutor: (id) => /llama|gpt-oss|qwen|gemma|mistral|kimi/i.test(id) && !/guard|whisper|tts|prompt|vision|speech/i.test(id)
}
const MENSAJES = {
  ok: 'Groq funciona con la clave y los modelos configurados.',
  sin_clave: 'Falta GROQ_API_KEY.',
  clave_invalida: 'Groq rechazó GROQ_API_KEY: la clave no es válida o fue eliminada. Crea una nueva en https://console.groq.com/keys y actualízala (en Render: Environment → GROQ_API_KEY).',
  sin_modelo: 'Groq no tiene disponible ningún modelo compatible para transcribir o para el tutor.',
  sin_conexion: 'No se pudo contactar a Groq desde el servidor.',
  error_groq: 'Groq respondió con un error. Intenta de nuevo en unos minutos.'
}

let ultimo = null
let enCurso = null

function elegirModelo (clase, disponibles) {
  const configurado = MODELOS_CONFIGURADOS[clase]
  if (disponibles.includes(configurado)) return configurado
  return PREFERIDOS[clase].find((id) => disponibles.includes(id)) || disponibles.find(ES_DE_CLASE[clase]) || null
}

function resultado (estado, extra = {}) {
  return { estado, mensaje: MENSAJES[estado], ...extra }
}

async function consultarGroq () {
  if (!entorno.groqApiKey) return resultado('sin_clave')
  let respuesta
  try {
    respuesta = await fetch(`${entorno.groqUrlBase}/models`, {
      headers: { Authorization: `Bearer ${entorno.groqApiKey}` },
      signal: AbortSignal.timeout(10000)
    })
  } catch {
    return resultado('sin_conexion')
  }
  if (respuesta.status === 401 || respuesta.status === 403) return resultado('clave_invalida')
  if (!respuesta.ok) return resultado('error_groq', { codigoHttp: respuesta.status })

  const datos = await respuesta.json().catch(() => ({}))
  const disponibles = (datos.data || []).filter((modelo) => modelo.active !== false).map((modelo) => modelo.id)
  const modelos = { transcripcion: elegirModelo('transcripcion', disponibles), tutor: elegirModelo('tutor', disponibles) }
  if (!modelos.transcripcion || !modelos.tutor) return resultado('sin_modelo', { modelos })

  // Se usan los modelos elegidos en las siguientes llamadas
  entorno.modeloTranscripcion = modelos.transcripcion
  entorno.modeloTutor = modelos.tutor
  const reemplazados = Object.keys(modelos).filter((clase) => modelos[clase] !== MODELOS_CONFIGURADOS[clase])
  return resultado('ok', { modelos, ...(reemplazados.length ? { reemplazados } : {}) })
}

// forzar: ignora el resultado guardado (por ejemplo, después de un error de modelo)
async function revisarIa ({ forzar = false } = {}) {
  if (!forzar && ultimo && Date.now() - ultimo.en < VIGENCIA_MS) return ultimo.resultado
  if (!enCurso) {
    enCurso = consultarGroq()
      .then((nuevo) => {
        ultimo = { en: Date.now(), resultado: nuevo }
        return nuevo
      })
      .finally(() => { enCurso = null })
  }
  return enCurso
}

// Para /api/salud: responde al instante con lo último que se sabe y actualiza en segundo plano
function estadoIaReciente () {
  if (!ultimo || Date.now() - ultimo.en >= VIGENCIA_MS) revisarIa().catch(() => {})
  return ultimo ? ultimo.resultado : { estado: entorno.groqApiKey ? 'revisando' : 'sin_clave' }
}

function reiniciarEstadoIa () {
  ultimo = null
  enCurso = null
  entorno.modeloTranscripcion = MODELOS_CONFIGURADOS.transcripcion
  entorno.modeloTutor = MODELOS_CONFIGURADOS.tutor
}

module.exports = { revisarIa, estadoIaReciente, reiniciarEstadoIa, elegirModelo }
