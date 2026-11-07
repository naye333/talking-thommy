require('dotenv').config()

// Centraliza la lectura de variables de entorno con valores por defecto seguros
const entorno = {
  puerto: Number(process.env.PUERTO) || 3000,
  nombreEntorno: process.env.ENTORNO || 'desarrollo',
  urlBaseDatos: process.env.DATABASE_URL || '',
  origenesPermitidos: (process.env.ORIGENES_PERMITIDOS || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  maxBytesAudioTurno: Number(process.env.MAX_BYTES_AUDIO_TURNO) || 25 * 1024 * 1024
}

module.exports = entorno
