// Perfil docente con la API real del backend (backend/src/rutas/docente.js).
// Misma interfaz que los datos de ejemplo de servicioDocente.js, así las pantallas no cambian.
import { ErrorApi } from '../../nucleo/clienteApi.js'

// Las pantallas comparan los id con los de data-id (texto): se entregan como texto
function normalizarRecomendacion (recomendacion) {
  return { ...recomendacion, id: String(recomendacion.id) }
}

function consulta (parametros) {
  const texto = new URLSearchParams(Object.entries(parametros).filter(([, valor]) => valor)).toString()
  return texto ? `?${texto}` : ''
}

export function crearServicioDocenteApi (cliente) {
  const rutaEstudiante = (id) => `/api/docente/estudiantes/${encodeURIComponent(id)}`

  return {
    capacidades: { datosEjemplo: false, envioPadres: false },

    async listarEstudiantes ({ busqueda = '' } = {}) {
      return (await cliente.get(`/api/docente/estudiantes${consulta({ busqueda: busqueda.trim() })}`)).estudiantes
    },

    async listarAlertas () {
      return (await cliente.get('/api/docente/alertas')).alertas
    },

    obtenerReporte (estudianteId, { periodo } = {}) {
      return cliente.get(`${rutaEstudiante(estudianteId)}/reporte${consulta({ periodo })}`)
    },

    obtenerFalencias (estudianteId) {
      return cliente.get(`${rutaEstudiante(estudianteId)}/falencias`)
    },

    obtenerDetalle (estudianteId, { periodo } = {}) {
      return cliente.get(`${rutaEstudiante(estudianteId)}/detalle${consulta({ periodo })}`)
    },

    async listarRecomendaciones (estudianteId) {
      const datos = await cliente.get(`${rutaEstudiante(estudianteId)}/recomendaciones`)
      return { ...datos, recomendaciones: datos.recomendaciones.map(normalizarRecomendacion) }
    },

    async agregarRecomendacion (estudianteId, texto) {
      const datos = await cliente.post(`${rutaEstudiante(estudianteId)}/recomendaciones`, { texto: String(texto || '').trim() })
      return normalizarRecomendacion(datos.recomendacion)
    },

    async actualizarRecomendacion (estudianteId, recomendacionId, { incluida }) {
      const datos = await cliente.patch(
        `${rutaEstudiante(estudianteId)}/recomendaciones/${encodeURIComponent(recomendacionId)}`,
        { incluida: Boolean(incluida) }
      )
      return normalizarRecomendacion(datos.recomendacion)
    },

    async eliminarRecomendacion (estudianteId, recomendacionId) {
      await cliente.delete(`${rutaEstudiante(estudianteId)}/recomendaciones/${encodeURIComponent(recomendacionId)}`)
      return { eliminada: String(recomendacionId) }
    },

    // → { estudiante, contrasenaTemporal } para el estudiante que olvidó su contraseña
    restablecerContrasena (estudianteId) {
      return cliente.post(`${rutaEstudiante(estudianteId)}/contrasena-temporal`)
    },

    // Pendiente de decisión del equipo (ver docs/propuesta-api-perfil-docente.md)
    async enviarReportePadres () {
      throw new ErrorApi({ codigo: 'SERVICIO_NO_DISPONIBLE', estado: 501 })
    }
  }
}
