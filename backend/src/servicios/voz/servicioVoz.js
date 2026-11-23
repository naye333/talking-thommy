// Audio de Thommy: genera la voz con Piper y la entrega por GET /api/voz/:id.
// La síntesis empieza en cuanto llega el texto, pero la respuesta del turno no la espera:
// la app recibe enseguida el texto con su audioUrl y el GET espera a que el audio esté listo.
// Si Piper no está instalado, audioUrl es null y la app usa la voz del dispositivo.
const crypto = require('crypto')
const entorno = require('../../config/entorno')
const { crearSintetizadorPiper } = require('./sintetizadorPiper')

const DURACION_MS = 10 * 60 * 1000
const MAX_AUDIOS = 200

function crearServicioVoz ({ sintetizador, ahora = Date.now } = {}) {
  const audios = new Map()

  function limpiarVencidos () {
    const momento = ahora()
    for (const [id, audio] of audios) {
      if (audio.expira <= momento) audios.delete(id)
    }
    // Los Map conservan el orden de inserción: se descartan los más antiguos
    while (audios.size >= MAX_AUDIOS) audios.delete(audios.keys().next().value)
  }

  return {
    get estaDisponible () {
      return sintetizador.estaConfigurado
    },
    // Empieza a generar el audio y devuelve la URL donde se podrá descargar (o null)
    prepararAudio (texto) {
      if (!sintetizador.estaConfigurado || !texto) return null
      limpiarVencidos()
      const id = crypto.randomUUID()
      const promesa = sintetizador.sintetizar(texto)
      // Se marca como manejada: el error se informa cuando la app pida el audio
      promesa.catch((error) => console.warn('[voz] no se pudo generar el audio:', error.message))
      audios.set(id, { promesa, expira: ahora() + DURACION_MS })
      return `/api/voz/${id}`
    },
    // Devuelve el WAV, null si el id no existe o venció, o lanza si la síntesis falló
    async obtenerAudio (id) {
      const audio = audios.get(id)
      if (!audio || audio.expira <= ahora()) return null
      return audio.promesa
    },
    estado () {
      return sintetizador.estado()
    },
    precalentar () {
      return sintetizador.precalentar()
    },
    detener () {
      sintetizador.detener()
    }
  }
}

const servicioVoz = crearServicioVoz({
  sintetizador: crearSintetizadorPiper({
    binario: entorno.piperBinario,
    modelo: entorno.piperModelo,
    tono: entorno.piperTono,
    velocidad: entorno.piperVelocidad
  })
})

module.exports = { crearServicioVoz, servicioVoz }
