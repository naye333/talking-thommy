const repositorioPractica = require('../repositorios/repositorioPractica')
const reportes = require('../servicios/servicioReportes')

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

module.exports = { consultarProgreso }
