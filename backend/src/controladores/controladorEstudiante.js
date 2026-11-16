const repositorioPractica = require('../repositorios/repositorioPractica')
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const reportes = require('../servicios/servicioReportes')
const servicioGrupos = require('../servicios/servicioGrupos')

// GET /api/estudiante/progreso?periodo= → mismo cálculo que el reporte del docente, para el estudiante del token
async function consultarProgreso (request, response, next) {
  try {
    const periodo = reportes.normalizarPeriodo(request.query.periodo)
    const ahora = new Date()
    const rangos = reportes.calcularRangos(periodo, ahora)
    const resultados = await repositorioPractica.listarResultados(
      [request.usuario.id], reportes.fechaInicialConsulta(rangos), new Date(ahora.getTime() + 1)
    )
    const { evolucion, fortalezas, areasMejorar } = reportes.construirDetalle(resultados, periodo, ahora)
    response.json({ ...reportes.construirReporte(resultados, periodo, ahora), evolucion, fortalezas, areasMejorar })
  } catch (error) {
    next(error)
  }
}

// GET /api/estudiante/grupo → { docente: { id, nombre } | null }
async function consultarGrupo (request, response, next) {
  try {
    const estudiante = await repositorioUsuarios.buscarPorId(request.usuario.id)
    const docente = estudiante?.docenteId ? await repositorioUsuarios.buscarPorId(estudiante.docenteId) : null
    response.json({ docente: docente ? { id: docente.id, nombre: docente.nombre } : null })
  } catch (error) {
    next(error)
  }
}

// POST /api/estudiante/grupo { codigo } → se une al grupo del docente dueño del código
async function unirseAGrupo (request, response, next) {
  try {
    const docente = await servicioGrupos.unirseAGrupo(request.usuario.id, request.body?.codigo)
    response.json({ docente })
  } catch (error) {
    next(error)
  }
}

module.exports = { consultarProgreso, consultarGrupo, unirseAGrupo }
