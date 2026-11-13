require('dotenv').config()

const nombreEntorno = process.env.ENTORNO || 'desarrollo'
const esProduccion = nombreEntorno === 'produccion'

// En producción el secreto es obligatorio; en desarrollo y pruebas hay uno de respaldo
const jwtSecreto = process.env.JWT_SECRETO || (esProduccion ? '' : 'secreto-solo-para-desarrollo')
if (!jwtSecreto) {
  throw new Error('Falta JWT_SECRETO en las variables de entorno de producción')
}

// Centraliza la lectura de variables de entorno con valores por defecto seguros
const entorno = {
  puerto: Number(process.env.PUERTO) || 3000,
  nombreEntorno,
  esProduccion,
  urlBaseDatos: process.env.DATABASE_URL || '',
  origenesPermitidos: (process.env.ORIGENES_PERMITIDOS || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  maxBytesAudioTurno: Number(process.env.MAX_BYTES_AUDIO_TURNO) || 25 * 1024 * 1024,
  jwtSecreto,
  jwtExpiracion: process.env.JWT_EXPIRACION || '7d'
}

module.exports = entorno
