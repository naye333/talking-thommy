const servicioSesiones = require('../servicios/servicioSesiones')
const { crearError } = require('../utilidades/errores')

// POST /api/sesiones { temaId } → { sesion: { id }, saludo: { texto, frase, audioUrl } }
async function crearSesion (request, response, next) {
  try {
    const temaId = request.body?.temaId ?? null
    if (temaId !== null && (!Number.isInteger(temaId) || temaId <= 0)) {
      throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'temaId', mensaje: 'temaId debe ser un entero positivo o null' }])
    }
    const resultado = await servicioSesiones.crearSesion({ usuario: request.usuario, temaId })
    response.status(201).json(resultado)
  } catch (error) {
    next(error)
  }
}

module.exports = { crearSesion }
