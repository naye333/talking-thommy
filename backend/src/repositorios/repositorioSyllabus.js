// Consultas de solo lectura sobre unidades_syllabus y temas
const { obtenerPool } = require('../config/baseDatos')
const { crearError } = require('../utilidades/errores')

function obtenerPoolObligatorio () {
  const pool = obtenerPool()
  if (!pool) throw crearError(503, 'BASE_DATOS_NO_DISPONIBLE')
  return pool
}

// Devuelve las unidades del nivel con el resumen de sus temas, en orden
async function listarUnidadesPorNivel (nivel) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT u.id AS unidad_id, u.numero AS unidad_numero, u.titulo AS unidad_titulo, u.descripcion,
            t.id AS tema_id, t.numero AS tema_numero, t.semana, t.titulo AS tema_titulo
       FROM unidades_syllabus u
       LEFT JOIN temas t ON t.unidad_id = u.id
      WHERE u.nivel = $1
      ORDER BY u.numero, t.numero`,
    [nivel]
  )

  const unidades = new Map()
  for (const fila of rows) {
    if (!unidades.has(fila.unidad_id)) {
      unidades.set(fila.unidad_id, {
        id: fila.unidad_id,
        numero: fila.unidad_numero,
        titulo: fila.unidad_titulo,
        descripcion: fila.descripcion,
        temas: []
      })
    }
    if (fila.tema_id) {
      unidades.get(fila.unidad_id).temas.push({
        id: fila.tema_id,
        numero: fila.tema_numero,
        semana: fila.semana,
        titulo: fila.tema_titulo
      })
    }
  }
  return [...unidades.values()]
}

async function buscarTemaPorId (id) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT t.id, t.unidad_id, u.nivel, u.titulo AS unidad_titulo, t.numero, t.semana, t.titulo,
            t.objetivo, t.gramatica, t.vocabulario, t.frases_modelo
       FROM temas t
       JOIN unidades_syllabus u ON u.id = t.unidad_id
      WHERE t.id = $1`,
    [id]
  )
  const fila = rows[0]
  if (!fila) return null
  return {
    id: fila.id,
    unidadId: fila.unidad_id,
    unidadTitulo: fila.unidad_titulo,
    nivel: fila.nivel,
    numero: fila.numero,
    semana: fila.semana,
    titulo: fila.titulo,
    objetivo: fila.objetivo,
    gramatica: fila.gramatica,
    vocabulario: fila.vocabulario,
    frasesModelo: fila.frases_modelo
  }
}

module.exports = { listarUnidadesPorNivel, buscarTemaPorId }
