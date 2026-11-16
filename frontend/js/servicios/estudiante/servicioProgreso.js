// Progreso del estudiante que inició sesión.
// Con usarDatosEjemplo: false y un cliente usa GET /api/estudiante/progreso (backend real).
// Con usarDatosEjemplo: true muestra los datos ficticios de una estudiante del perfil docente.
import { ErrorApi } from '../../nucleo/clienteApi.js'
import { crearServicioDocente } from '../docente/servicioDocente.js'

const ESTUDIANTE_EJEMPLO = 1

export function crearServicioProgreso ({ usarDatosEjemplo, demoraMs, cliente = null }) {
  if (!usarDatosEjemplo && cliente) {
    return {
      capacidades: { datosEjemplo: false },
      obtenerProgreso ({ periodo } = {}) {
        const consulta = periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''
        return cliente.get(`/api/estudiante/progreso${consulta}`)
      }
    }
  }

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
