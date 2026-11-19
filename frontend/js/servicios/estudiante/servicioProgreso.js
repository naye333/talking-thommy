// Progreso del estudiante que inició sesión.
// DATOS DE EJEMPLO: mientras no exista GET /api/estudiante/progreso (ver docs/contrato-api-perfil-estudiante.md),
// muestra los datos ficticios de una estudiante del perfil docente para no duplicarlos.
import { ErrorApi } from '../../nucleo/clienteApi.js'
import { crearServicioDocente } from '../docente/servicioDocente.js'

const ESTUDIANTE_EJEMPLO = 1

export function crearServicioProgreso ({ usarDatosEjemplo, demoraMs }) {
  const ejemplo = crearServicioDocente({ usarDatosEjemplo, demoraMs })

  return {
    capacidades: { datosEjemplo: Boolean(usarDatosEjemplo) },

    // → { periodo, promedioGeneral, variacion, areas, evolucion, fortalezas, areasMejorar }
    async obtenerProgreso ({ periodo } = {}) {
      if (!usarDatosEjemplo) throw new ErrorApi({ codigo: 'SERVICIO_NO_DISPONIBLE', estado: 501 })
      const [reporte, detalle] = await Promise.all([
        ejemplo.obtenerReporte(ESTUDIANTE_EJEMPLO, { periodo }),
        ejemplo.obtenerDetalle(ESTUDIANTE_EJEMPLO, { periodo })
      ])
      const { estudiante, ...resto } = reporte
      return { ...resto, evolucion: detalle.evolucion, fortalezas: detalle.fortalezas, areasMejorar: detalle.areasMejorar }
    }
  }
}
