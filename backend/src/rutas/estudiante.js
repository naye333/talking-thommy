const { Router } = require('express')
const controlador = require('../controladores/controladorEstudiante')
const { exigirToken, exigirRol } = require('../middlewares/autenticacion')

const rutasEstudiante = Router()

rutasEstudiante.use(exigirToken, exigirRol('estudiante'))
rutasEstudiante.get('/progreso', controlador.consultarProgreso)

module.exports = rutasEstudiante
