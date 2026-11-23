// "¿Olvidaste tu contraseña?" en dos pasos:
// 1. verificar: el usuario resuelve el captcha y escribe su correo y el código de su clase.
//    Si coinciden, recibe un permiso de un solo uso que vence en 10 minutos.
// 2. cambiar: con ese permiso escribe su nueva contraseña.
// El código de la clase es el código de grupo de su docente (o el propio, si es docente).
const crypto = require('crypto')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const servicioGrupos = require('./servicioGrupos')
const { cifrarContrasena } = require('./servicioAutenticacion')
const { crearError } = require('../utilidades/errores')

function crearServicioRecuperacion ({ captcha, duracionPermisoMs = 10 * 60 * 1000, ahora = () => Date.now() }) {
  const permisos = new Map()

  function limpiarVencidos () {
    const momento = ahora()
    for (const [token, permiso] of permisos) {
      if (permiso.expira <= momento) permisos.delete(token)
    }
  }

  async function verificar ({ correo, codigoGrupo, captchaId, captchaRespuesta }) {
    if (!captcha.verificar(captchaId, captchaRespuesta)) {
      throw crearError(400, 'CAPTCHA_INCORRECTO', [{ campo: 'captchaRespuesta', mensaje: 'Las letras no coinciden' }])
    }

    const usuario = await repositorioUsuarios.buscarPorCorreo(correo)
    const codigoCuenta = usuario ? await repositorioUsuarios.obtenerCodigoClaseDeUsuario(usuario.id) : null
    // Mismo error si el correo no existe, si no tiene clase o si el código no coincide:
    // así nadie puede averiguar qué correos están registrados
    if (!codigoCuenta || codigoCuenta !== servicioGrupos.normalizarCodigo(codigoGrupo)) {
      throw crearError(400, 'VERIFICACION_FALLIDA')
    }

    limpiarVencidos()
    const tokenRecuperacion = crypto.randomBytes(32).toString('base64url')
    permisos.set(tokenRecuperacion, { usuarioId: usuario.id, expira: ahora() + duracionPermisoMs })
    return { tokenRecuperacion, nombre: usuario.nombre.split(' ')[0] }
  }

  async function cambiar ({ tokenRecuperacion, contrasenaNueva }) {
    const permiso = typeof tokenRecuperacion === 'string' ? permisos.get(tokenRecuperacion) : null
    if (!permiso || permiso.expira <= ahora()) {
      if (permiso) permisos.delete(tokenRecuperacion)
      throw crearError(400, 'RECUPERACION_VENCIDA')
    }
    // Se gasta antes de guardar: un permiso sirve para un solo cambio
    permisos.delete(tokenRecuperacion)
    await repositorioUsuarios.actualizarContrasena(permiso.usuarioId, await cifrarContrasena(contrasenaNueva))
  }

  return { verificar, cambiar }
}

module.exports = { crearServicioRecuperacion }
