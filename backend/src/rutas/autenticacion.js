const { Router } = require('express')
const controlador = require('../controladores/controladorAutenticacion')
const { exigirToken } = require('../middlewares/autenticacion')

const rutasAutenticacion = Router()

rutasAutenticacion.post('/registro', controlador.registrar)
rutasAutenticacion.post('/ingreso', controlador.ingresar)
rutasAutenticacion.get('/yo', exigirToken, controlador.consultarUsuarioActual)

module.exports = rutasAutenticacion
