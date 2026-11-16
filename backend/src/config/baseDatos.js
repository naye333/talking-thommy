const { Pool } = require('pg')
const entorno = require('../config/entorno')

let pool = null

// Crea el pool solo si hay cadena de conexión; así el servidor arranca sin BD en pruebas
function obtenerPool () {
  if (!entorno.urlBaseDatos) return null
  if (!pool) {
    pool = new Pool({
      // El SSL lo define la cadena de Neon (?sslmode=require)
      connectionString: entorno.urlBaseDatos,
      max: 10,
      idleTimeoutMillis: 30000
    })
    pool.on('error', (error) => {
      console.error('[bd] error inesperado en el pool:', error.message)
    })
  }
  return pool
}

// Igual que obtenerPool, pero responde 503 si la base de datos no está configurada
function obtenerPoolObligatorio () {
  const poolActual = obtenerPool()
  if (!poolActual) {
    const error = new Error('Base de datos no configurada')
    error.estado = 503
    error.codigo = 'BASE_DATOS_NO_DISPONIBLE'
    throw error
  }
  return poolActual
}

// Verifica la conexión con una consulta mínima
async function verificarConexion () {
  const poolActual = obtenerPool()
  if (!poolActual) return { estaConectada: false, motivo: 'DATABASE_URL no configurada' }
  try {
    await poolActual.query('SELECT 1')
    return { estaConectada: true }
  } catch (error) {
    return { estaConectada: false, motivo: error.message }
  }
}

async function cerrarPool () {
  if (pool) {
    await pool.end()
    pool = null
  }
}

module.exports = { obtenerPool, obtenerPoolObligatorio, verificarConexion, cerrarPool }
