// Carga (o actualiza) el syllabus desde un archivo JSON. Se puede ejecutar varias veces.
// Uso: npm run sembrar-syllabus                       → carga semillas/syllabus-ingles-1.json
//      npm run sembrar-syllabus -- ruta/a/otro.json   → carga otro archivo (por ejemplo, Inglés II)
const fs = require('fs')
const path = require('path')
const { obtenerPool, cerrarPool } = require('../config/baseDatos')
const { validarSyllabus } = require('../validaciones/validacionesSyllabus')

const ARCHIVO_POR_DEFECTO = path.join(__dirname, 'semillas', 'syllabus-ingles-1.json')

async function guardarUnidad (cliente, unidad) {
  const { rows } = await cliente.query(
    `INSERT INTO unidades_syllabus (nivel, numero, titulo, descripcion)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (nivel, numero) DO UPDATE
       SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion
     RETURNING id`,
    [unidad.nivel, unidad.numero, unidad.titulo, unidad.descripcion || null]
  )
  const unidadId = rows[0].id

  for (const tema of unidad.temas) {
    await cliente.query(
      `INSERT INTO temas (unidad_id, numero, semana, titulo, objetivo, gramatica, vocabulario, frases_modelo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (unidad_id, numero) DO UPDATE
         SET semana = EXCLUDED.semana, titulo = EXCLUDED.titulo, objetivo = EXCLUDED.objetivo,
             gramatica = EXCLUDED.gramatica, vocabulario = EXCLUDED.vocabulario,
             frases_modelo = EXCLUDED.frases_modelo`,
      [unidadId, tema.numero, tema.semana ?? null, tema.titulo, tema.objetivo,
        tema.gramatica, tema.vocabulario, tema.frasesModelo]
    )
  }
  return unidad.temas.length
}

async function sembrarSyllabus (rutaArchivo = ARCHIVO_POR_DEFECTO) {
  const datos = JSON.parse(fs.readFileSync(rutaArchivo, 'utf8'))
  const errores = validarSyllabus(datos)
  if (errores.length > 0) {
    throw new Error(`el archivo tiene errores:\n  - ${errores.join('\n  - ')}`)
  }

  const pool = obtenerPool()
  if (!pool) throw new Error('Configura DATABASE_URL en el archivo .env')

  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    let totalTemas = 0
    for (const unidad of datos.unidades) totalTemas += await guardarUnidad(cliente, unidad)
    await cliente.query('COMMIT')
    console.log(`[syllabus] ${datos.unidades.length} unidades y ${totalTemas} temas cargados desde ${path.basename(rutaArchivo)}`)
  } catch (error) {
    await cliente.query('ROLLBACK')
    throw error
  } finally {
    cliente.release()
  }
}

sembrarSyllabus(process.argv[2])
  .finally(cerrarPool)
  .catch((error) => {
    console.error('[syllabus] ERROR:', error.message)
    process.exitCode = 1
  })
