const servicioAutenticacion = require('../servicios/servicioAutenticacion')
const { validarRegistro, validarIngreso } = require('../validaciones/validacionesAutenticacion')
const { crearError } = require('../utilidades/errores')

async function registrar (request, response, next) {
  try {
    const { errores, datos } = validarRegistro(request.body)
    if (errores.length > 0) throw crearError(400, 'DATOS_INVALIDOS', errores)
    const resultado = await servicioAutenticacion.registrarEstudiante(datos)
    response.status(201).json(resultado)
  } catch (error) {
    next(error)
  }
}

async function ingresar (request, response, next) {
  try {
    const { errores, datos } = validarIngreso(request.body)
    if (errores.length > 0) throw crearError(400, 'DATOS_INVALIDOS', errores)
    const resultado = await servicioAutenticacion.iniciarSesion(datos)
    response.json(resultado)
  } catch (error) {
    next(error)
  }
}

async function consultarUsuarioActual (request, response, next) {
  try {
    const usuario = await servicioAutenticacion.obtenerUsuarioActual(request.usuario.id)
    response.json({ usuario })
  } catch (error) {
    next(error)
  }
}

module.exports = { registrar, ingresar, consultarUsuarioActual }
