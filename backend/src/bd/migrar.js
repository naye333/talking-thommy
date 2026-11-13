// Ejecuta en orden los archivos .sql de bd/migraciones que aún no se han aplicado.
// Uso: npm run migrar
const fs = require('fs')
const path = require('path')
const { obtenerPool, cerrarPool } = require('../config/baseDatos')

const CARPETA_MIGRACIONES = path.join(__dirname, 'migraciones')

async function ejecutarMigraciones () {
  const pool = obtenerPool()
  if (!pool) throw new Error('Configura DATABASE_URL en el archivo .env')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      nombre      VARCHAR(200) PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const { rows } = await pool.query('SELECT nombre FROM migraciones_aplicadas')
  const aplicadas = new Set(rows.map((fila) => fila.nombre))
  const archivos = fs.readdirSync(CARPETA_MIGRACIONES).filter((archivo) => archivo.endsWith('.sql')).sort()

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue
    const sql = fs.readFileSync(path.join(CARPETA_MIGRACIONES, archivo), 'utf8')
    const cliente = await pool.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query(sql)
      await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo])
      await cliente.query('COMMIT')
      console.log(`[migrar] aplicada: ${archivo}`)
    } catch (error) {
      await cliente.query('ROLLBACK')
      throw new Error(`falló ${archivo}: ${error.message}`)
    } finally {
      cliente.release()
    }
  }
  console.log('[migrar] base de datos al día')
}

ejecutarMigraciones()
  .finally(cerrarPool)
  .catch((error) => {
    console.error('[migrar] ERROR:', error.message)
    process.exitCode = 1
  })
