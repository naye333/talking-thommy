// Acceso a la tabla usuarios. Las funciones devuelven objetos en camelCase.
const { obtenerPool } = require('../config/baseDatos')

const COLUMNAS = 'id, nombre, correo, hash_contrasena, rol, nivel, creado_en'

function mapearUsuario (fila) {
  if (!fila) return null
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    hashContrasena: fila.hash_contrasena,
    rol: fila.rol,
    nivel: fila.nivel,
    creadoEn: fila.creado_en
  }
}

function obtenerPoolObligatorio () {
  const pool = obtenerPool()
  if (!pool) {
    const error = new Error('Base de datos no configurada')
    error.estado = 503
    error.codigo = 'BASE_DATOS_NO_DISPONIBLE'
    throw error
  }
  return pool
}

async function buscarPorCorreo (correo) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT ${COLUMNAS} FROM usuarios WHERE correo = $1`, [correo]
  )
  return mapearUsuario(rows[0])
}

async function buscarPorId (id) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [id]
  )
  return mapearUsuario(rows[0])
}

async function crearUsuario ({ nombre, correo, hashContrasena, rol, nivel }) {
  try {
    const { rows } = await obtenerPoolObligatorio().query(
      `INSERT INTO usuarios (nombre, correo, hash_contrasena, rol, nivel)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
      [nombre, correo, hashContrasena, rol, nivel]
    )
    return mapearUsuario(rows[0])
  } catch (error) {
    // 23505 = violación de UNIQUE en PostgreSQL
    if (error.code === '23505') {
      const errorCorreo = new Error('Correo en uso')
      errorCorreo.estado = 409
      errorCorreo.codigo = 'CORREO_EN_USO'
      throw errorCorreo
    }
    throw error
  }
}

function mapearEstudiante (fila) {
  return { id: fila.id, nombre: fila.nombre, nivel: fila.nivel }
}

// Estudiantes a cargo del docente; busqueda filtra por nombre sin distinguir mayúsculas ni tildes
async function listarEstudiantesDeDocente (docenteId, busqueda = '') {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT id, nombre, nivel FROM usuarios
      WHERE rol = 'estudiante' AND docente_id = $1
        AND translate(lower(nombre), 'áéíóúüñ', 'aeiouun') LIKE '%' || translate(lower($2), 'áéíóúüñ', 'aeiouun') || '%'
      ORDER BY nombre`,
    [docenteId, busqueda]
  )
  return rows.map(mapearEstudiante)
}

async function buscarEstudianteDeDocente (docenteId, estudianteId) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT id, nombre, nivel FROM usuarios
      WHERE rol = 'estudiante' AND docente_id = $1 AND id = $2`,
    [docenteId, estudianteId]
  )
  return rows[0] ? mapearEstudiante(rows[0]) : null
}

// Asigna el docente a los estudiantes indicados por correo; devuelve cuántos se actualizaron
async function asignarDocente (docenteId, correosEstudiantes) {
  const { rowCount } = await obtenerPoolObligatorio().query(
    `UPDATE usuarios SET docente_id = $1, actualizado_en = NOW()
      WHERE rol = 'estudiante' AND correo = ANY($2::text[])`,
    [docenteId, correosEstudiantes]
  )
  return rowCount
}

module.exports = {
  buscarPorCorreo,
  buscarPorId,
  crearUsuario,
  listarEstudiantesDeDocente,
  buscarEstudianteDeDocente,
  asignarDocente
}
