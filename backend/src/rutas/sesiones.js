const { Router } = require('express')
const controlador = require('../controladores/controladorSesiones')
const { exigirToken, exigirRol } = require('../middlewares/autenticacion')

const rutasSesiones = Router()

rutasSesiones.post('/', exigirToken, exigirRol('estudiante'), controlador.crearSesion)

module.exports = rutasSesiones
