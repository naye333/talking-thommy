// Códigos de grupo: vinculan a un estudiante con su docente
const crypto = require('crypto')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const { crearError } = require('../utilidades/errores')

// Sin 0/O ni 1/I/L para que no se confundan al dictarlos en clase
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LONGITUD_CODIGO = 6
const MAX_INTENTOS = 5

function generarCodigo () {
  let codigo = ''
  for (let i = 0; i < LONGITUD_CODIGO; i++) codigo += ALFABETO[crypto.randomInt(ALFABETO.length)]
  return codigo
}

function normalizarCodigo (codigo) {
  return typeof codigo === 'string' ? codigo.trim().toUpperCase().replace(/[\s-]/g, '') : ''
}

// Asigna un código nuevo al docente; reintenta si choca con otro existente
async function asignarCodigoNuevo (docenteId) {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    try {
      return await repositorioUsuarios.actualizarCodigoGrupo(docenteId, generarCodigo())
    } catch (error) {
      if (error.codigo !== 'CODIGO_EN_USO') throw error
    }
  }
  throw crearError(500, 'ERROR_INTERNO')
}

async function obtenerCodigo (docenteId) {
  return (await repositorioUsuarios.obtenerCodigoGrupo(docenteId)) || asignarCodigoNuevo(docenteId)
}

// Devuelve el docente dueño del código o lanza CODIGO_GRUPO_INVALIDO
async function buscarDocentePorCodigo (codigo) {
  const normalizado = normalizarCodigo(codigo)
  const docente = normalizado ? await repositorioUsuarios.buscarDocentePorCodigo(normalizado) : null
  if (!docente) {
    throw crearError(400, 'CODIGO_GRUPO_INVALIDO', [{ campo: 'codigoGrupo', mensaje: 'No existe un grupo con ese código' }])
  }
  return docente
}

async function unirseAGrupo (estudianteId, codigo) {
  const docente = await buscarDocentePorCodigo(codigo)
  await repositorioUsuarios.asignarDocentePorId(estudianteId, docente.id)
  return { id: docente.id, nombre: docente.nombre }
}

module.exports = { generarCodigo, normalizarCodigo, asignarCodigoNuevo, obtenerCodigo, buscarDocentePorCodigo, unirseAGrupo }
