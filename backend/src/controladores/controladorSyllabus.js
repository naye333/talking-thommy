const repositorioSyllabus = require('../repositorios/repositorioSyllabus')
const { crearError } = require('../utilidades/errores')

// Si no se envía ?nivel, se usa el nivel del estudiante que está en el token
function resolverNivel (consulta, usuario) {
  const nivel = consulta.nivel === undefined ? usuario.nivel : Number(consulta.nivel)
  if (![1, 2].includes(nivel)) {
    throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'nivel', mensaje: 'El nivel debe ser 1 o 2' }])
  }
  return nivel
}

async function listarSyllabus (request, response, next) {
  try {
    const nivel = resolverNivel(request.query, request.usuario)
    const unidades = await repositorioSyllabus.listarUnidadesPorNivel(nivel)
    response.json({ nivel, unidades })
  } catch (error) {
    next(error)
  }
}

async function consultarTema (request, response, next) {
  try {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'id', mensaje: 'El id debe ser un entero positivo' }])
    }
    const tema = await repositorioSyllabus.buscarTemaPorId(id)
    if (!tema) throw crearError(404, 'TEMA_NO_ENCONTRADO')
    response.json({ tema })
  } catch (error) {
    next(error)
  }
}

module.exports = { listarSyllabus, consultarTema }
