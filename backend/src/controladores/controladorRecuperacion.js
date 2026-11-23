// "¿Olvidaste tu contraseña?": captcha, verificación con el código de la clase y contraseña nueva
const { validarVerificacionRecuperacion, validarCambioRecuperacion } = require('../validaciones/validacionesAutenticacion')
const { crearError } = require('../utilidades/errores')

function crearControladorRecuperacion ({ captcha, recuperacion }) {
  return {
    generarCaptcha (_request, response) {
      // Cada captcha es distinto y de un solo uso: nunca se guarda en caché
      response.set('Cache-Control', 'no-store')
      response.json(captcha.generar())
    },

    async verificar (request, response, next) {
      try {
        const { errores, datos } = validarVerificacionRecuperacion(request.body)
        if (errores.length > 0) throw crearError(400, 'DATOS_INVALIDOS', errores)
        response.json(await recuperacion.verificar(datos))
      } catch (error) {
        next(error)
      }
    },

    async cambiar (request, response, next) {
      try {
        const { errores, datos } = validarCambioRecuperacion(request.body)
        if (errores.length > 0) throw crearError(400, 'DATOS_INVALIDOS', errores)
        await recuperacion.cambiar(datos)
        response.status(204).end()
      } catch (error) {
        next(error)
      }
    }
  }
}

module.exports = { crearControladorRecuperacion }
