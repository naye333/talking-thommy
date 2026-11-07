const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const entorno = require('./config/entorno')
const rutasSalud = require('./rutas/salud')
const rutasAutenticacion = require('./rutas/autenticacion')

function crearApp () {
  const app = express()

  app.use(helmet())
  app.use(cors({
    origin: entorno.origenesPermitidos.length > 0 ? entorno.origenesPermitidos : true
  }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/salud', rutasSalud)
  app.use('/api/auth', rutasAutenticacion)
  // Próximas rutas: /api/syllabus, /api/sesiones, /api/reportes

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
