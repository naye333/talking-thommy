const { Router } = require('express')
const controlador = require('../controladores/controladorAutenticacion')
const { exigirToken } = require('../middlewares/autenticacion')
const { crearLimiteIntentos } = require('../middlewares/limiteIntentos')

// Se crea por app para que cada instancia (y cada archivo de pruebas) lleve su propio conteo
function crearRutasAutenticacion () {
  const rutas = Router()
  const limiteIntentos = crearLimiteIntentos()

  rutas.post('/registro', limiteIntentos, controlador.registrar)
  rutas.post('/ingreso', limiteIntentos, controlador.ingresar)
  rutas.get('/yo', exigirToken, controlador.consultarUsuarioActual)
  rutas.patch('/contrasena', exigirToken, limiteIntentos, controlador.cambiarContrasena)
  return rutas
}

module.exports = { crearRutasAutenticacion }
