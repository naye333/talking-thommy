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

module.exports = { buscarPorCorreo, buscarPorId, crearUsuario }
