const { Router } = require('express')
const controlador = require('../controladores/controladorSesiones')
const { exigirToken, exigirRol } = require('../middlewares/autenticacion')

const rutasSesiones = Router()

// Solo los estudiantes practican con Thommy
rutasSesiones.post('/', exigirToken, exigirRol('estudiante'), controlador.crearSesion)

module.exports = rutasSesiones
