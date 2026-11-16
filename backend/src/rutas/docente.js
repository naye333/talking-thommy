const { Router } = require('express')
const controlador = require('../controladores/controladorDocente')
const { exigirToken, exigirRol } = require('../middlewares/autenticacion')

const rutasDocente = Router()

rutasDocente.use(exigirToken, exigirRol('docente'))
rutasDocente.get('/grupo', controlador.consultarGrupo)
rutasDocente.post('/grupo/codigo', controlador.regenerarCodigoGrupo)
rutasDocente.get('/estudiantes', controlador.listarEstudiantes)
rutasDocente.get('/alertas', controlador.listarAlertas)
rutasDocente.get('/estudiantes/:id/reporte', controlador.consultarReporte)
rutasDocente.get('/estudiantes/:id/detalle', controlador.consultarDetalle)
rutasDocente.get('/estudiantes/:id/falencias', controlador.consultarFalencias)
rutasDocente.post('/estudiantes/:id/contrasena-temporal', controlador.restablecerContrasenaEstudiante)
rutasDocente.get('/estudiantes/:id/recomendaciones', controlador.listarRecomendaciones)
rutasDocente.post('/estudiantes/:id/recomendaciones', controlador.crearRecomendacion)
rutasDocente.patch('/estudiantes/:id/recomendaciones/:recId', controlador.actualizarRecomendacion)
rutasDocente.delete('/estudiantes/:id/recomendaciones/:recId', controlador.eliminarRecomendacion)

module.exports = rutasDocente
