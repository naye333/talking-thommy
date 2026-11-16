// Frena a quien prueba contraseñas a la fuerza: solo cuentan los intentos que fallan
const { rateLimit } = require('express-rate-limit')
const entorno = require('../config/entorno')

const VENTANA_MS = 15 * 60 * 1000

function crearLimiteIntentos ({ maximo = entorno.maxIntentosAuth } = {}) {
  return rateLimit({
    windowMs: VENTANA_MS,
    limit: maximo,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ error: 'DEMASIADOS_INTENTOS' })
  })
}

module.exports = { crearLimiteIntentos }
