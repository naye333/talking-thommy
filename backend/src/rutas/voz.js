const { Router } = require('express')
const { servicioVoz } = require('../servicios/voz/servicioVoz')

// GET /api/voz/:id → WAV con la voz de Thommy. El id es aleatorio, de un solo turno y vence en minutos,
// por eso no pide token: así la etiqueta <audio> de la app lo puede reproducir directamente.
function crearRutasVoz (voz = servicioVoz) {
  const rutas = Router()
  rutas.get('/:id', async (request, response) => {
    if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return response.status(404).json({ error: 'AUDIO_NO_ENCONTRADO' })
    try {
      const wav = await voz.obtenerAudio(request.params.id)
      if (!wav) return response.status(404).json({ error: 'AUDIO_NO_ENCONTRADO' })
      response.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=600' }).send(wav)
    } catch {
      // La app usa la voz del dispositivo si el audio falla
      response.status(503).json({ error: 'VOZ_NO_DISPONIBLE' })
    }
  })
  return rutas
}

module.exports = { crearRutasVoz }
