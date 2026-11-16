// Perfil docente: solo puede consultar a los estudiantes que tiene asignados (usuarios.docente_id)
const repositorioUsuarios = require('../repositorios/repositorioUsuarios')
const repositorioPractica = require('../repositorios/repositorioPractica')
const repositorioRecomendaciones = require('../repositorios/repositorioRecomendaciones')
const reportes = require('../servicios/servicioReportes')
const { crearError } = require('../utilidades/errores')

const MAX_LONGITUD_RECOMENDACION = 140

function leerEnteroPositivo (valor, campo) {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero <= 0) {
    throw crearError(400, 'DATOS_INVALIDOS', [{ campo, mensaje: `${campo} debe ser un entero positivo` }])
  }
  return numero
}

async function obtenerEstudiante (request) {
  const estudianteId = leerEnteroPositivo(request.params.id, 'id')
  const estudiante = await repositorioUsuarios.buscarEstudianteDeDocente(request.usuario.id, estudianteId)
  // También 404 si el estudiante existe pero no es de este docente
  if (!estudiante) throw crearError(404, 'ESTUDIANTE_NO_ENCONTRADO')
  return estudiante
}

async function cargarResultados (estudiantesIds, periodo, ahora) {
  if (estudiantesIds.length === 0) return []
  const rangos = reportes.calcularRangos(periodo, ahora)
  return repositorioPractica.listarResultados(
    estudiantesIds, reportes.fechaInicialConsulta(rangos), new Date(ahora.getTime() + 1)
  )
}

function agruparPorEstudiante (resultados) {
  const grupos = new Map()
  for (const resultado of resultados) {
    if (!grupos.has(resultado.estudianteId)) grupos.set(resultado.estudianteId, [])
    grupos.get(resultado.estudianteId).push(resultado)
  }
  return grupos
}

// Estudiantes del docente con su resumen del último mes
async function resumirEstudiantes (docenteId, busqueda) {
  const estudiantes = await repositorioUsuarios.listarEstudiantesDeDocente(docenteId, busqueda)
  const ahora = new Date()
  const resultados = await cargarResultados(estudiantes.map((estudiante) => estudiante.id), reportes.PERIODO_POR_DEFECTO, ahora)
  const porEstudiante = agruparPorEstudiante(resultados)
  return estudiantes.map((estudiante) => ({
    ...estudiante,
    ...reportes.resumirEstudiante(porEstudiante.get(estudiante.id) || [], reportes.PERIODO_POR_DEFECTO, ahora)
  }))
}

async function listarEstudiantes (request, response, next) {
  try {
    const busqueda = typeof request.query.busqueda === 'string' ? request.query.busqueda.trim().slice(0, 100) : ''
    const resumenes = await resumirEstudiantes(request.usuario.id, busqueda)
    response.json({
      estudiantes: resumenes.map(({ id, nombre, nivel, promedioGeneral, variacion }) => ({ id, nombre, nivel, promedioGeneral, variacion }))
    })
  } catch (error) {
    next(error)
  }
}

async function listarAlertas (request, response, next) {
  try {
    const resumenes = await resumirEstudiantes(request.usuario.id, '')
    const alertas = resumenes
      .map((resumen) => ({ resumen, motivo: reportes.construirAlerta(resumen) }))
      .filter(({ motivo }) => motivo)
      .map(({ resumen, motivo }) => ({
        id: resumen.id, nombre: resumen.nombre, nivel: resumen.nivel, promedioGeneral: resumen.promedioGeneral, motivo
      }))
    response.json({ alertas })
  } catch (error) {
    next(error)
  }
}

async function consultarReporte (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const periodo = reportes.normalizarPeriodo(request.query.periodo)
    const ahora = new Date()
    const resultados = await cargarResultados([estudiante.id], periodo, ahora)
    response.json({ estudiante, ...reportes.construirReporte(resultados, periodo, ahora) })
  } catch (error) {
    next(error)
  }
}

async function consultarDetalle (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const periodo = reportes.normalizarPeriodo(request.query.periodo)
    const ahora = new Date()
    const resultados = await cargarResultados([estudiante.id], periodo, ahora)
    response.json({ estudiante, ...reportes.construirDetalle(resultados, periodo, ahora) })
  } catch (error) {
    next(error)
  }
}

// Las falencias se calculan con todo el semestre
async function falenciasDe (estudiante) {
  const ahora = new Date()
  const resultados = await cargarResultados([estudiante.id], 'semestre', ahora)
  const { actual } = reportes.calcularRangos('semestre', ahora)
  return reportes.calcularFalencias(resultados.filter((resultado) => resultado.creadoEn >= actual.desde))
}

async function consultarFalencias (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    response.json({ estudiante, falencias: await falenciasDe(estudiante) })
  } catch (error) {
    next(error)
  }
}

async function listarRecomendaciones (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const docenteId = request.usuario.id
    let recomendaciones = await repositorioRecomendaciones.listar(estudiante.id, docenteId)
    // La primera vez se proponen sugerencias a partir de las falencias; el docente las puede quitar
    if (recomendaciones.length === 0) {
      const sugerencias = reportes.sugerirRecomendaciones(await falenciasDe(estudiante))
      for (const texto of sugerencias) {
        await repositorioRecomendaciones.crear({ estudianteId: estudiante.id, docenteId, texto, propia: false })
      }
      if (sugerencias.length > 0) recomendaciones = await repositorioRecomendaciones.listar(estudiante.id, docenteId)
    }
    response.json({ estudiante, recomendaciones })
  } catch (error) {
    next(error)
  }
}

async function crearRecomendacion (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const texto = typeof request.body?.texto === 'string' ? request.body.texto.trim() : ''
    if (texto.length < 1 || texto.length > MAX_LONGITUD_RECOMENDACION) {
      throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'texto', mensaje: `Entre 1 y ${MAX_LONGITUD_RECOMENDACION} caracteres` }])
    }
    const recomendacion = await repositorioRecomendaciones.crear({
      estudianteId: estudiante.id, docenteId: request.usuario.id, texto, propia: true
    })
    response.status(201).json({ recomendacion })
  } catch (error) {
    next(error)
  }
}

async function actualizarRecomendacion (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const id = leerEnteroPositivo(request.params.recId, 'recId')
    if (typeof request.body?.incluida !== 'boolean') {
      throw crearError(400, 'DATOS_INVALIDOS', [{ campo: 'incluida', mensaje: 'incluida debe ser true o false' }])
    }
    const recomendacion = await repositorioRecomendaciones.actualizarIncluida({
      id, estudianteId: estudiante.id, docenteId: request.usuario.id, incluida: request.body.incluida
    })
    if (!recomendacion) throw crearError(404, 'RECOMENDACION_NO_ENCONTRADA')
    response.json({ recomendacion })
  } catch (error) {
    next(error)
  }
}

async function eliminarRecomendacion (request, response, next) {
  try {
    const estudiante = await obtenerEstudiante(request)
    const id = leerEnteroPositivo(request.params.recId, 'recId')
    const fueEliminada = await repositorioRecomendaciones.eliminar({ id, estudianteId: estudiante.id, docenteId: request.usuario.id })
    if (!fueEliminada) throw crearError(404, 'RECOMENDACION_NO_ENCONTRADA')
    response.status(204).end()
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listarEstudiantes,
  listarAlertas,
  consultarReporte,
  consultarDetalle,
  consultarFalencias,
  listarRecomendaciones,
  crearRecomendacion,
  actualizarRecomendacion,
  eliminarRecomendacion
}
