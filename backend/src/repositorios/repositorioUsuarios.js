// Acceso a la tabla usuarios. Las funciones devuelven objetos en camelCase.
const { obtenerPool } = require('../config/baseDatos')

const COLUMNAS = 'id, nombre, correo, hash_contrasena, rol, nivel, docente_id, creado_en'

function mapearUsuario (fila) {
  if (!fila) return null
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    hashContrasena: fila.hash_contrasena,
    rol: fila.rol,
    nivel: fila.nivel,
    docenteId: fila.docente_id ?? null,
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

async function crearUsuario ({ nombre, correo, hashContrasena, rol, nivel, docenteId = null }) {
  try {
    const { rows } = await obtenerPoolObligatorio().query(
      `INSERT INTO usuarios (nombre, correo, hash_contrasena, rol, nivel, docente_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNAS}`,
      [nombre, correo, hashContrasena, rol, nivel, docenteId]
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

async function actualizarContrasena (id, hashContrasena) {
  await obtenerPoolObligatorio().query(
    'UPDATE usuarios SET hash_contrasena = $2, actualizado_en = NOW() WHERE id = $1',
    [id, hashContrasena]
  )
}

async function asignarDocentePorId (estudianteId, docenteId) {
  await obtenerPoolObligatorio().query(
    `UPDATE usuarios SET docente_id = $2, actualizado_en = NOW()
      WHERE id = $1 AND rol = 'estudiante'`,
    [estudianteId, docenteId]
  )
}

async function buscarDocentePorCodigo (codigo) {
  const { rows } = await obtenerPoolObligatorio().query(
    "SELECT id, nombre FROM usuarios WHERE rol = 'docente' AND codigo_grupo = $1",
    [codigo]
  )
  return rows[0] || null
}

async function obtenerCodigoGrupo (docenteId) {
  const { rows } = await obtenerPoolObligatorio().query(
    "SELECT codigo_grupo FROM usuarios WHERE id = $1 AND rol = 'docente'",
    [docenteId]
  )
  return rows[0]?.codigo_grupo || null
}

// Código de la clase de una cuenta: el del docente del estudiante, o el propio si es docente
async function obtenerCodigoClaseDeUsuario (usuarioId) {
  const { rows } = await obtenerPoolObligatorio().query(
    `SELECT CASE WHEN u.rol = 'docente' THEN u.codigo_grupo ELSE d.codigo_grupo END AS codigo
       FROM usuarios u
       LEFT JOIN usuarios d ON d.id = u.docente_id AND d.rol = 'docente'
      WHERE u.id = $1`,
    [usuarioId]
  )
  return rows[0]?.codigo || null
}

// Devuelve el código guardado; lanza CODIGO_EN_USO si otro docente ya lo tiene
async function actualizarCodigoGrupo (docenteId, codigo) {
  try {
    await obtenerPoolObligatorio().query(
      "UPDATE usuarios SET codigo_grupo = $2, actualizado_en = NOW() WHERE id = $1 AND rol = 'docente'",
      [docenteId, codigo]
    )
    return codigo
  } catch (error) {
    if (error.code === '23505') {
      const errorCodigo = new Error('Código en uso')
      errorCodigo.codigo = 'CODIGO_EN_USO'
      throw errorCodigo
    }
    throw error
  }
}

module.exports = {
  buscarPorCorreo,
  buscarPorId,
  crearUsuario,
  listarEstudiantesDeDocente,
  buscarEstudianteDeDocente,
  asignarDocente,
  actualizarContrasena,
  asignarDocentePorId,
  buscarDocentePorCodigo,
  obtenerCodigoGrupo,
  obtenerCodigoClaseDeUsuario,
  actualizarCodigoGrupo
}
