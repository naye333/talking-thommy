const { verificarToken } = require('../servicios/servicioAutenticacion')
const { crearError } = require('../utilidades/errores')

// Exige "Authorization: Bearer <token>" y deja el usuario en request.usuario
function exigirToken (request, _response, next) {
  const encabezado = request.headers.authorization || ''
  const [tipo, token] = encabezado.split(' ')
  if (tipo !== 'Bearer' || !token) return next(crearError(401, 'TOKEN_REQUERIDO'))

  try {
    request.usuario = verificarToken(token)
    next()
  } catch (error) {
    next(error)
  }
}

// Uso: router.get('/curso', exigirToken, exigirRol('docente'), controlador)
function exigirRol (...rolesPermitidos) {
  return (request, _response, next) => {
    if (!request.usuario || !rolesPermitidos.includes(request.usuario.rol)) {
      return next(crearError(403, 'PERMISO_DENEGADO'))
    }
    next()
  }
}

module.exports = { exigirToken, exigirRol }
