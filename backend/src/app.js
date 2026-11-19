const path = require('path')
const fs = require('fs')
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

// La app web (carpeta frontend) se sirve desde el mismo servidor: así en Render hay una sola
// dirección para todos. Solo se publican los archivos de la app, nunca código ni configuración.
const CARPETA_FRONTEND = path.join(__dirname, '..', '..', 'frontend')
const CONTENIDO_APP = ['css', 'js', 'assets']

function servirAppWeb (app) {
  const indice = path.join(CARPETA_FRONTEND, 'index.html')
  if (!fs.existsSync(indice)) return
  app.get(['/', '/index.html'], (_request, response) => response.sendFile(indice))
  for (const carpeta of CONTENIDO_APP) {
    app.use(`/${carpeta}`, express.static(path.join(CARPETA_FRONTEND, carpeta), { index: false }))
  }
}

function crearApp () {
  const app = express()
  // Render pone un proxy delante: así el límite de intentos ve la IP real del cliente
  app.set('trust proxy', 1)

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // Fuentes de Google para la app; el WebSocket y la API están en la misma dirección ('self')
        'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'media-src': ["'self'", 'blob:', 'data:'],
        // En local (http://localhost:3000) no se fuerza https
        'upgrade-insecure-requests': entorno.esProduccion ? [] : null
      }
    }
  }))
  app.use(cors({
    origin: entorno.origenesPermitidos.length > 0 ? entorno.origenesPermitidos : true
  }))
  app.use(express.json({ limit: '1mb' }))

  servirAppWeb(app)
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
    // Sin base de datos, una línea clara basta (el detalle ya se mostró al arrancar)
    if (error.codigo === 'BASE_DATOS_NO_DISPONIBLE') console.warn('[api] petición rechazada: falta DATABASE_URL (ejecuta npm run verificar)')
    else if (estado >= 500) console.error('[api]', error)

    const cuerpo = { error: estado >= 500 && !error.codigo ? 'ERROR_INTERNO' : error.codigo }
    if (error.detalles) cuerpo.detalles = error.detalles
    response.status(estado).json(cuerpo)
  })

  return app
}

module.exports = { crearApp }
