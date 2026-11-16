// Recomendaciones del docente para el reporte de un estudiante
const { obtenerPoolObligatorio } = require('../config/baseDatos')

const COLUMNAS = 'id, texto, incluida, propia'

function mapear (fila) {
  if (!fila) return null
  return { id: fila.id, texto: fila.texto, incluida: fila.incluida, propia: fila.propia }
}

async function listar (estudianteId, docenteId) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT ${COLUMNAS} FROM recomendaciones
      WHERE estudiante_id = $1 AND docente_id = $2 ORDER BY id`,
    [estudianteId, docenteId]
  )
  return rows.map(mapear)
}

async function crear ({ estudianteId, docenteId, texto, propia }) {
  const { rows } = await obtenerPoolObligatorio().query(
    `INSERT INTO recomendaciones (estudiante_id, docente_id, texto, propia)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
    [estudianteId, docenteId, texto, propia]
  )
  return mapear(rows[0])
}

async function actualizarIncluida ({ id, estudianteId, docenteId, incluida }) {
  const { rows } = await obtenerPoolObligatorio().query(
    `UPDATE recomendaciones SET incluida = $4
      WHERE id = $1 AND estudiante_id = $2 AND docente_id = $3 RETURNING ${COLUMNAS}`,
    [id, estudianteId, docenteId, incluida]
  )
  return mapear(rows[0])
}

// Devuelve true si se eliminó
async function eliminar ({ id, estudianteId, docenteId }) {
  const { rowCount } = await obtenerPoolObligatorio().query(
    'DELETE FROM recomendaciones WHERE id = $1 AND estudiante_id = $2 AND docente_id = $3',
    [id, estudianteId, docenteId]
  )
  return rowCount > 0
}

module.exports = { listar, crear, actualizarIncluida, eliminar }
