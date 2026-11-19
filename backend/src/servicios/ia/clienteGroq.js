// Cliente mínimo de la API de Groq (compatible con OpenAI) usando fetch nativo de Node 20.
//  - transcribirAudio: voz → texto con Whisper
//  - completarJson: respuesta del tutor en formato JSON
const entorno = require('../../config/entorno')
const { crearError } = require('../../utilidades/errores')
const estadoIa = require('./estadoIa')

// Whisper deduce el formato por la extensión del archivo, así que la detectamos por los primeros bytes
function detectarFormatoAudio (audio) {
  if (audio.length >= 4 && audio.readUInt32BE(0) === 0x1a45dfa3) return { extension: 'webm', tipo: 'audio/webm' }
  if (audio.length >= 12 && audio.toString('ascii', 4, 8) === 'ftyp') return { extension: 'm4a', tipo: 'audio/mp4' }
  if (audio.toString('ascii', 0, 4) === 'OggS') return { extension: 'ogg', tipo: 'audio/ogg' }
  if (audio.toString('ascii', 0, 4) === 'RIFF') return { extension: 'wav', tipo: 'audio/wav' }
  if (audio.toString('ascii', 0, 3) === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0)) {
    return { extension: 'mp3', tipo: 'audio/mpeg' }
  }
  return null
}

function exigirClave () {
  if (!entorno.groqApiKey) throw crearError(503, 'TUTOR_NO_DISPONIBLE')
}

// Traduce la respuesta de Groq a un código que explica la causa
function codigoSegunRespuesta (estado, detalle) {
  if (estado === 401 || estado === 403) return 'IA_CLAVE_INVALIDA'
  if (estado === 429) return 'IA_LIMITE_ALCANZADO'
  if (estado === 404 || /model_not_found|decommissioned|does not exist/i.test(detalle)) return 'IA_MODELO_NO_DISPONIBLE'
  return 'IA_NO_DISPONIBLE'
}

// Si Groq retiró el modelo, se elige otro disponible y se reintenta una vez
// obtenerModelo devuelve el modelo que usa la llamada (puede cambiar tras la revisión)
async function conReintentoDeModelo (obtenerModelo, llamar) {
  const modelo = obtenerModelo()
  try {
    return await llamar()
  } catch (error) {
    if (error.codigo !== 'IA_MODELO_NO_DISPONIBLE') throw error
    estadoIa.marcarModeloRechazado(modelo)
    const estado = await estadoIa.revisarIa({ forzar: true })
    if (estado.estado !== 'ok' || obtenerModelo() === modelo) throw error
    console.warn(`[ia] ! Groq rechazó el modelo ${modelo}; se usa ${obtenerModelo()}`)
    return llamar()
  }
}

async function llamarGroq (ruta, opciones) {
  let respuesta
  try {
    respuesta = await fetch(`${entorno.groqUrlBase}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${entorno.groqApiKey}`, ...opciones.headers },
      signal: AbortSignal.timeout(entorno.tiempoMaximoIaMs)
    })
  } catch (error) {
    const codigo = error.name === 'TimeoutError' ? 'IA_TIEMPO_AGOTADO' : 'IA_NO_DISPONIBLE'
    throw crearError(502, codigo)
  }
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    console.error(`[ia] Groq respondió ${respuesta.status} en ${ruta}: ${detalle.slice(0, 300)}`)
    throw crearError(502, codigoSegunRespuesta(respuesta.status, detalle))
  }
  return respuesta.json()
}

// Devuelve { texto, duracion (segundos), segmentos: [{ inicio, fin, texto }] }
async function transcribirAudio (audio) {
  exigirClave()
  const formato = detectarFormatoAudio(audio)
  if (!formato) throw crearError(415, 'FORMATO_AUDIO_NO_SOPORTADO')

  const datos = await conReintentoDeModelo(() => entorno.modeloTranscripcion, () => {
    // El formulario se arma en cada intento porque el modelo puede cambiar
    const formulario = new FormData()
    formulario.append('file', new Blob([audio], { type: formato.tipo }), `turno.${formato.extension}`)
    formulario.append('model', entorno.modeloTranscripcion)
    formulario.append('language', 'en')
    formulario.append('response_format', 'verbose_json')
    formulario.append('temperature', '0')
    return llamarGroq('/audio/transcriptions', { method: 'POST', body: formulario })
  })
  return {
    texto: (datos.text || '').trim(),
    duracion: Number(datos.duration) || 0,
    segmentos: (datos.segments || []).map((segmento) => ({
      inicio: segmento.start,
      fin: segmento.end,
      texto: segmento.text
    }))
  }
}

// Envía la conversación y devuelve el objeto JSON que produce el modelo
async function completarJson (mensajes, { temperatura = 0.4 } = {}) {
  exigirClave()
  const datos = await conReintentoDeModelo(() => entorno.modeloTutor, () => llamarGroq('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: entorno.modeloTutor,
      messages: mensajes,
      temperature: temperatura,
      max_tokens: 700,
      response_format: { type: 'json_object' }
    })
  }))
  try {
    return JSON.parse(datos.choices[0].message.content)
  } catch {
    throw crearError(502, 'IA_RESPUESTA_INVALIDA')
  }
}

module.exports = { detectarFormatoAudio, transcribirAudio, completarJson, codigoSegunRespuesta }
