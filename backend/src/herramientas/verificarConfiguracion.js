// Revisa que el backend esté listo para usarse y explica cómo arreglar lo que falte.
// Uso: npm run verificar
const fs = require('fs')
const path = require('path')
const entorno = require('../config/entorno')
const { obtenerPool, verificarConexion, cerrarPool } = require('../config/baseDatos')
const { revisarConfiguracion, formatearProblema, explicarErrorBaseDatos } = require('../config/diagnostico')

const CARPETA_MIGRACIONES = path.join(__dirname, '..', 'bd', 'migraciones')

async function revisarMigraciones (pool) {
  const archivos = fs.readdirSync(CARPETA_MIGRACIONES).filter((archivo) => archivo.endsWith('.sql')).sort()
  let aplicadas = []
  try {
    aplicadas = (await pool.query('SELECT nombre FROM migraciones_aplicadas')).rows.map((fila) => fila.nombre)
  } catch {
    aplicadas = []
  }
  return archivos.filter((archivo) => !aplicadas.includes(archivo))
}

async function contar (pool, sql) {
  try {
    return Number((await pool.query(sql)).rows[0].total)
  } catch {
    return null
  }
}

// Comprueba la clave de Groq con una consulta que no gasta cuota (lista de modelos)
async function revisarGroq () {
  if (!entorno.groqApiKey) return null
  try {
    const respuesta = await fetch(`${entorno.groqUrlBase}/models`, {
      headers: { Authorization: `Bearer ${entorno.groqApiKey}` },
      signal: AbortSignal.timeout(10000)
    })
    if (respuesta.ok) return { ok: true }
    if (respuesta.status === 401) return { ok: false, mensaje: 'Groq rechazó la clave: revisa GROQ_API_KEY (debe empezar por gsk_).' }
    return { ok: false, mensaje: `Groq respondió ${respuesta.status}. Intenta de nuevo en unos minutos.` }
  } catch {
    return { ok: false, mensaje: 'No se pudo contactar a Groq. Revisa la conexión a internet.' }
  }
}

async function verificar ({ escribir = console.log } = {}) {
  let errores = 0
  const ok = (texto) => escribir(`✔ ${texto}`)
  const fallo = (texto, solucion) => {
    errores++
    escribir(`✘ ${texto}${solucion ? `\n    → ${solucion}` : ''}`)
  }

  escribir(`Revisando la configuración de ${entorno.rutaEnv}\n`)
  const problemas = revisarConfiguracion()
  for (const problema of problemas) {
    escribir(formatearProblema(problema))
    if (problema.gravedad === 'error') errores++
  }

  if (entorno.urlBaseDatos) {
    const { estaConectada, motivo } = await verificarConexion()
    if (!estaConectada) {
      fallo(`No se pudo conectar a la base de datos: ${explicarErrorBaseDatos(motivo)}`)
    } else {
      ok('Conexión a la base de datos')
      const pool = obtenerPool()
      const pendientes = await revisarMigraciones(pool)
      if (pendientes.length) fallo(`Faltan migraciones: ${pendientes.join(', ')}`, 'Ejecuta: npm run migrar')
      else ok('Tablas al día (todas las migraciones aplicadas)')

      const temas = await contar(pool, 'SELECT count(*) AS total FROM temas')
      if (!temas) fallo('No hay syllabus cargado', 'Ejecuta: npm run sembrar-syllabus')
      else ok(`Syllabus cargado (${temas} temas)`)

      const docentes = await contar(pool, "SELECT count(*) AS total FROM usuarios WHERE rol = 'docente'")
      if (!docentes) fallo('No hay cuentas de docente', 'Ejecuta: npm run crear-docente -- correo "Nombre" "contrasena"')
      else ok(`Cuentas de docente: ${docentes}`)
    }
  }

  const groq = await revisarGroq()
  if (groq?.ok) ok('Clave de Groq válida (Thommy puede escuchar y responder)')
  else if (groq) fallo(groq.mensaje)

  escribir(errores === 0 ? '\nTodo listo. Inicia el servidor con: npm run dev' : `\n${errores} problema(s) por resolver.`)
  return errores
}

if (require.main === module) {
  verificar()
    .then((errores) => { process.exitCode = errores > 0 ? 1 : 0 })
    .catch((error) => {
      console.error('[verificar] ERROR:', error.message)
      process.exitCode = 1
    })
    .finally(cerrarPool)
}

module.exports = { verificar }
