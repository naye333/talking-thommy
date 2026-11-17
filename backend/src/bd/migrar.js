// Ejecuta en orden los archivos .sql de bd/migraciones que aún no se han aplicado.
// Uso: npm run migrar (el servidor también lo hace solo al arrancar)
const fs = require('fs')
const path = require('path')
const { obtenerPool, cerrarPool } = require('../config/baseDatos')

const CARPETA_MIGRACIONES = path.join(__dirname, 'migraciones')
// Número fijo para el candado de PostgreSQL: si dos servidores arrancan a la vez contra la misma
// base (por ejemplo, dos integrantes con Neon), el segundo espera a que el primero termine
const CANDADO_MIGRACIONES = 2026111701

function listarMigraciones () {
  return fs.readdirSync(CARPETA_MIGRACIONES).filter((archivo) => archivo.endsWith('.sql')).sort()
}

// Devuelve la lista de migraciones que se aplicaron en esta ejecución
async function ejecutarMigraciones ({ log = console.log } = {}) {
  const pool = obtenerPool()
  if (!pool) throw new Error('Configura DATABASE_URL en el archivo .env')

  const cliente = await pool.connect()
  const aplicadasAhora = []
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [CANDADO_MIGRACIONES])
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
        nombre      VARCHAR(200) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    const { rows } = await cliente.query('SELECT nombre FROM migraciones_aplicadas')
    const aplicadas = new Set(rows.map((fila) => fila.nombre))

    for (const archivo of listarMigraciones()) {
      if (aplicadas.has(archivo)) continue
      const sql = fs.readFileSync(path.join(CARPETA_MIGRACIONES, archivo), 'utf8')
      try {
        await cliente.query('BEGIN')
        await cliente.query(sql)
        await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo])
        await cliente.query('COMMIT')
        aplicadasAhora.push(archivo)
        log(`[migrar] aplicada: ${archivo}`)
      } catch (error) {
        await cliente.query('ROLLBACK')
        throw new Error(`falló ${archivo}: ${error.message}`)
      }
    }
    log('[migrar] base de datos al día')
    return aplicadasAhora
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [CANDADO_MIGRACIONES]).catch(() => {})
    cliente.release()
  }
}

if (require.main === module) {
  ejecutarMigraciones()
    .finally(cerrarPool)
    .catch((error) => {
      console.error('[migrar] ERROR:', error.message)
      process.exitCode = 1
    })
}

module.exports = { ejecutarMigraciones, listarMigraciones }
