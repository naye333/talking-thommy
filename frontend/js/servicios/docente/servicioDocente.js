// Servicio de datos del perfil docente. Las pantallas solo usan esta interfaz.
//
// Hoy responde con datos de ejemplo porque el backend no tiene estos endpoints.
// Cuando existan (ver docs/propuesta-api-perfil-docente.md), se reemplaza la implementación de cada
// método por una llamada al cliente de la API, sin tocar las pantallas.
import { ErrorApi } from '../../nucleo/clienteApi.js'
import { normalizarTexto } from '../../nucleo/dom.js'
import { AREAS, ESTUDIANTES, FALENCIAS_POR_AREA, AJUSTES_POR_PERIODO } from './datosEjemplo.js'

export const PERIODOS = [
  { valor: 'ultima_semana', etiqueta: 'Última semana', comparacion: 'vs. semana anterior' },
  { valor: 'ultimo_mes', etiqueta: 'Último mes', comparacion: 'vs. mes anterior' },
  { valor: 'semestre', etiqueta: 'Semestre', comparacion: 'vs. inicio del semestre' }
]

export const PERIODO_POR_DEFECTO = 'ultimo_mes'
export const MAX_LONGITUD_RECOMENDACION = 140
const UMBRAL_ALERTA_PROMEDIO = 65

export function obtenerPeriodo (valor) {
  return PERIODOS.find((periodo) => periodo.valor === valor) || PERIODOS.find((periodo) => periodo.valor === PERIODO_POR_DEFECTO)
}

function limitar (valor) {
  return Math.min(100, Math.max(0, Math.round(valor)))
}

function promedio (valores) {
  return limitar(valores.reduce((suma, valor) => suma + valor, 0) / valores.length)
}

function resumenEstudiante (estudiante) {
  return { id: estudiante.id, nombre: estudiante.nombre, nivel: estudiante.nivel }
}

function calcularAreas (estudiante, periodo) {
  const { ajusteAreas } = AJUSTES_POR_PERIODO[periodo]
  return AREAS.map((area, indice) => ({ ...area, valor: limitar(estudiante.areas[indice] + ajusteAreas) }))
}

function calcularEvolucion (estudiante, periodo) {
  const ajuste = AJUSTES_POR_PERIODO[periodo]
  const promedioPeriodo = promedio(calcularAreas(estudiante, periodo).map((area) => area.valor))
  const valores = ajuste.desplazamientos
    ? ajuste.desplazamientos.map((desplazamiento) => limitar(promedioPeriodo + desplazamiento * Math.sign(ajuste.variacion(estudiante) || 1)))
    : estudiante.evolucionMes
  return valores.map((valor, indice) => ({ etiqueta: ajuste.etiquetas[indice], valor }))
}

function calcularFalencias (estudiante) {
  return Object.entries(estudiante.falencias)
    .map(([clave, porcentaje]) => ({
      clave,
      area: AREAS.find((area) => area.clave === clave).nombre,
      tema: FALENCIAS_POR_AREA[clave].tema,
      descripcion: FALENCIAS_POR_AREA[clave].descripcion,
      porcentaje
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje)
}

export function crearServicioDocente ({ usarDatosEjemplo, demoraMs = 220 } = {}) {
  const recomendacionesPorEstudiante = new Map()
  let contadorRecomendaciones = 0

  // Simula la latencia de la red y entrega copias para que las pantallas no alteren el estado interno
  async function responder (obtener) {
    if (!usarDatosEjemplo) throw new ErrorApi({ codigo: 'SERVICIO_NO_DISPONIBLE', estado: 501 })
    if (demoraMs > 0) await new Promise((resolve) => setTimeout(resolve, demoraMs))
    return structuredClone(obtener())
  }

  function buscarEstudiante (id) {
    const estudiante = ESTUDIANTES.find((candidato) => candidato.id === Number(id))
    if (!estudiante) throw new ErrorApi({ codigo: 'ESTUDIANTE_NO_ENCONTRADO', estado: 404 })
    return estudiante
  }

  function recomendacionesDe (estudiante) {
    if (!recomendacionesPorEstudiante.has(estudiante.id)) {
      const iniciales = calcularFalencias(estudiante).map((falencia) => crearRecomendacion(FALENCIAS_POR_AREA[falencia.clave].recomendacion, false))
      recomendacionesPorEstudiante.set(estudiante.id, iniciales)
    }
    return recomendacionesPorEstudiante.get(estudiante.id)
  }

  // incluida: si la sugerencia forma parte del reporte; propia: si la escribió el docente
  function crearRecomendacion (texto, propia) {
    contadorRecomendaciones += 1
    return { id: `rec-${contadorRecomendaciones}`, texto, incluida: true, propia }
  }

  function buscarRecomendacion (estudiante, recomendacionId) {
    const recomendacion = recomendacionesDe(estudiante).find((candidata) => candidata.id === recomendacionId)
    if (!recomendacion) throw new ErrorApi({ codigo: 'RECOMENDACION_NO_ENCONTRADA', estado: 404 })
    return recomendacion
  }

  return {
    capacidades: { datosEjemplo: Boolean(usarDatosEjemplo), envioPadres: false },

    listarEstudiantes ({ busqueda = '' } = {}) {
      return responder(() => {
        const filtro = normalizarTexto(busqueda)
        return ESTUDIANTES
          .filter((estudiante) => normalizarTexto(estudiante.nombre).includes(filtro))
          .map((estudiante) => ({
            ...resumenEstudiante(estudiante),
            promedioGeneral: promedio(estudiante.areas),
            variacion: estudiante.variacionMes
          }))
      })
    },

    listarAlertas () {
      return responder(() => ESTUDIANTES
        .map((estudiante) => ({ estudiante, promedioGeneral: promedio(estudiante.areas) }))
        .filter(({ estudiante, promedioGeneral }) => promedioGeneral < UMBRAL_ALERTA_PROMEDIO || estudiante.variacionMes < 0)
        .map(({ estudiante, promedioGeneral }) => ({
          ...resumenEstudiante(estudiante),
          promedioGeneral,
          motivo: promedioGeneral < UMBRAL_ALERTA_PROMEDIO
            ? `Promedio de ${promedioGeneral}%`
            : `Bajó ${Math.abs(estudiante.variacionMes)}% este mes`
        })))
    },

    obtenerReporte (estudianteId, { periodo = PERIODO_POR_DEFECTO } = {}) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        const { valor } = obtenerPeriodo(periodo)
        const areas = calcularAreas(estudiante, valor)
        return {
          estudiante: resumenEstudiante(estudiante),
          periodo: valor,
          promedioGeneral: promedio(areas.map((area) => area.valor)),
          variacion: AJUSTES_POR_PERIODO[valor].variacion(estudiante),
          areas
        }
      })
    },

    obtenerFalencias (estudianteId) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        return { estudiante: resumenEstudiante(estudiante), falencias: calcularFalencias(estudiante) }
      })
    },

    obtenerDetalle (estudianteId, { periodo = PERIODO_POR_DEFECTO } = {}) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        const { valor } = obtenerPeriodo(periodo)
        const areas = calcularAreas(estudiante, valor)
        const mejorArea = [...areas].sort((a, b) => b.valor - a.valor)[0]
        const fortalezas = [`Buen desempeño en ${mejorArea.nombre}`]
        if (estudiante.practicaConstante) fortalezas.push('Practica con frecuencia con Thommy')
        return {
          estudiante: resumenEstudiante(estudiante),
          periodo: valor,
          evolucion: calcularEvolucion(estudiante, valor),
          fortalezas,
          areasMejorar: calcularFalencias(estudiante).slice(0, 2).map((falencia) => falencia.area)
        }
      })
    },

    listarRecomendaciones (estudianteId) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        return { estudiante: resumenEstudiante(estudiante), recomendaciones: recomendacionesDe(estudiante) }
      })
    },

    agregarRecomendacion (estudianteId, texto) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        const limpio = String(texto || '').trim()
        if (!limpio || limpio.length > MAX_LONGITUD_RECOMENDACION) {
          throw new ErrorApi({
            codigo: 'DATOS_INVALIDOS',
            estado: 400,
            detalles: [{ campo: 'texto', mensaje: `Escribe entre 1 y ${MAX_LONGITUD_RECOMENDACION} caracteres` }]
          })
        }
        const recomendacion = crearRecomendacion(limpio, true)
        recomendacionesDe(estudiante).push(recomendacion)
        return recomendacion
      })
    },

    actualizarRecomendacion (estudianteId, recomendacionId, { incluida }) {
      return responder(() => {
        const recomendacion = buscarRecomendacion(buscarEstudiante(estudianteId), recomendacionId)
        recomendacion.incluida = Boolean(incluida)
        return recomendacion
      })
    },

    eliminarRecomendacion (estudianteId, recomendacionId) {
      return responder(() => {
        const estudiante = buscarEstudiante(estudianteId)
        buscarRecomendacion(estudiante, recomendacionId)
        const restantes = recomendacionesDe(estudiante).filter((recomendacion) => recomendacion.id !== recomendacionId)
        recomendacionesPorEstudiante.set(estudiante.id, restantes)
        return { eliminada: recomendacionId }
      })
    },

    // No existe un servicio de envío a padres en el backend: siempre responde que no está disponible
    async enviarReportePadres () {
      throw new ErrorApi({ codigo: 'SERVICIO_NO_DISPONIBLE', estado: 501 })
    }
  }
}
