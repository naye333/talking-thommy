const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const entorno = require('./config/entorno')
const rutasSalud = require('./rutas/salud')
const { crearRutasAutenticacion } = require('./rutas/autenticacion')
const rutasSyllabus = require('./rutas/syllabus')
const rutasSesiones = require('./rutas/sesiones')
const rutasEstudiante = require('./rutas/estudiante')
const rutasDocente = require('./rutas/docente')

function crearApp () {
  const app = express()
  // Render pone un proxy delante: así el límite de intentos ve la IP real del cliente
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors({
    origin: entorno.origenesPermitidos.length > 0 ? entorno.origenesPermitidos : true
  }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/salud', rutasSalud)
  app.use('/api/auth', crearRutasAutenticacion())
  app.use('/api/syllabus', rutasSyllabus)
  app.use('/api/sesiones', rutasSesiones)
  app.use('/api/estudiante', rutasEstudiante)
  app.use('/api/docente', rutasDocente)

  // Ruta no encontrada
  app.use((_request, response) => {
    response.status(404).json({ error: 'RUTA_NO_ENCONTRADA' })
  })

  // Manejador central de errores
  app.use((error, _request, response, _next) => {
    // JSON mal formado en el cuerpo de la petición
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'JSON_INVALIDO' })
    }
    const estado = error.estado || 500
    if (estado >= 500) console.error('[api]', error)

    const cuerpo = { error: estado >= 500 && !error.codigo ? 'ERROR_INTERNO' : error.codigo }
    if (error.detalles) cuerpo.detalles = error.detalles
    response.status(estado).json(cuerpo)
  })

  return app
}

module.exports = { crearApp }
