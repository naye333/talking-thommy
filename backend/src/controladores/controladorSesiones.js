const repositorioPractica = require('../repositorios/repositorioPractica')
const repositorioSyllabus = require('../repositorios/repositorioSyllabus')
const { construirSaludo } = require('../servicios/servicioTutor')
const { crearError } = require('../utilidades/errores')

// POST /api/sesiones { temaId } → crea la sesión de práctica y devuelve el saludo de Thommy
async function crearSesion (request, response, next) {
  try {
    const { temaId = null } = request.body || {}
    let tema = null
    if (temaId !== null) {
      const id = Number(temaId)
      if (!Number.isInteger(id) || id <= 0) {
        throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'temaId', mensaje: 'temaId debe ser un entero positivo o null' }])
      }
      tema = await repositorioSyllabus.buscarTemaPorId(id)
      if (!tema) throw crearError(404, 'TEMA_NO_ENCONTRADO')
    }

    const saludo = construirSaludo(tema)
    const sesion = await repositorioPractica.crearSesion({
      estudianteId: request.usuario.id,
      temaId: tema ? tema.id : null,
      fraseInicial: saludo.frase
    })
    response.status(201).json({ sesion: { id: sesion.id, temaId: sesion.temaId }, saludo })
  } catch (error) {
    next(error)
  }
}

module.exports = { crearSesion }
