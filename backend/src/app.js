const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const entorno = require('./config/entorno')
const rutasSalud = require('./rutas/salud')

function crearApp () {
  const app = express()

  app.use(helmet())
  app.use(cors({
    origin: entorno.origenesPermitidos.length > 0 ? entorno.origenesPermitidos : true
  }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/salud', rutasSalud)
  // Próximas rutas: /api/auth, /api/syllabus, /api/sesiones, /api/reportes

  // Ruta no encontrada
  app.use((_request, response) => {
    response.status(404).json({ error: 'RUTA_NO_ENCONTRADA' })
  })

  // Manejador central de errores
  app.use((error, _request, response, _next) => {
    console.error('[api]', error)
    response.status(error.estado || 500).json({ error: error.codigo || 'ERROR_INTERNO' })
  })

  return app
}

module.exports = { crearApp }
