const { Router } = require('express')
const controlador = require('../controladores/controladorSyllabus')
const { exigirToken } = require('../middlewares/autenticacion')

const rutasSyllabus = Router()

// Todo el syllabus exige sesión iniciada (estudiante o docente)
rutasSyllabus.use(exigirToken)
rutasSyllabus.get('/', controlador.listarSyllabus)
rutasSyllabus.get('/temas/:id', controlador.consultarTema)

module.exports = rutasSyllabus
