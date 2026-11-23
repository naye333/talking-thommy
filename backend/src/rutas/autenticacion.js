const { Router } = require('express')
const controlador = require('../controladores/controladorAutenticacion')
const { exigirToken } = require('../middlewares/autenticacion')
const { crearLimiteIntentos, crearLimitePeticiones } = require('../middlewares/limiteIntentos')
const { crearServicioCaptcha } = require('../servicios/servicioCaptcha')
const { crearServicioRecuperacion } = require('../servicios/servicioRecuperacion')
const { crearControladorRecuperacion } = require('../controladores/controladorRecuperacion')

// Se crea por app para que cada instancia (y cada archivo de pruebas) lleve su propio conteo
function crearRutasAutenticacion ({ captcha = crearServicioCaptcha() } = {}) {
  const rutas = Router()
  const limiteIntentos = crearLimiteIntentos()
  const recuperacion = crearControladorRecuperacion({ captcha, recuperacion: crearServicioRecuperacion({ captcha }) })

  rutas.post('/registro', limiteIntentos, controlador.registrar)
  rutas.post('/ingreso', limiteIntentos, controlador.ingresar)
  rutas.get('/yo', exigirToken, controlador.consultarUsuarioActual)
  rutas.patch('/contrasena', exigirToken, limiteIntentos, controlador.cambiarContrasena)

  // ¿Olvidaste tu contraseña? Los intentos fallidos cuentan en el mismo límite que el ingreso
  rutas.get('/captcha', crearLimitePeticiones(), recuperacion.generarCaptcha)
  rutas.post('/recuperar/verificar', limiteIntentos, recuperacion.verificar)
  rutas.post('/recuperar/cambiar', limiteIntentos, recuperacion.cambiar)
  return rutas
}

module.exports = { crearRutasAutenticacion }
