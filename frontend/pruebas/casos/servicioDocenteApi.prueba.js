import { describir, afirmar } from '../marco.js'
import { crearServicioDocente } from '../../js/servicios/docente/servicioDocente.js'
import { crearServicioProgreso } from '../../js/servicios/estudiante/servicioProgreso.js'

// Cliente falso que registra las llamadas y responde según la ruta
function crearClienteFalso (respuestas) {
  const llamadas = []
  const responder = (metodo) => async (ruta, cuerpo) => {
    llamadas.push({ metodo, ruta, cuerpo })
    const respuesta = respuestas[`${metodo} ${ruta.split('?')[0]}`]
    return typeof respuesta === 'function' ? respuesta(cuerpo) : respuesta
  }
  return { llamadas, get: responder('GET'), post: responder('POST'), patch: responder('PATCH'), delete: responder('DELETE') }
}

describir('servicioDocente con la API real', (prueba) => {
  prueba('usa la API cuando no hay datos de ejemplo y hay cliente', async () => {
    const cliente = crearClienteFalso({
      'GET /api/docente/estudiantes': { estudiantes: [{ id: 1, nombre: 'Ana', nivel: 1, promedioGeneral: 80, variacion: 2 }] },
      'GET /api/docente/alertas': { alertas: [] }
    })
    const servicio = crearServicioDocente({ usarDatosEjemplo: false, cliente })
    afirmar.igual(servicio.capacidades.datosEjemplo, false)
    afirmar.igual((await servicio.listarEstudiantes({ busqueda: ' ana ' }))[0].nombre, 'Ana')
    afirmar.igual(cliente.llamadas[0].ruta, '/api/docente/estudiantes?busqueda=ana')
    afirmar.profundo(await servicio.listarAlertas(), [])
  })

  prueba('pide reporte, detalle y falencias con el periodo', async () => {
    const cliente = crearClienteFalso({
      'GET /api/docente/estudiantes/7/reporte': { promedioGeneral: 70 },
      'GET /api/docente/estudiantes/7/detalle': { evolucion: [] },
      'GET /api/docente/estudiantes/7/falencias': { falencias: [] }
    })
    const servicio = crearServicioDocente({ usarDatosEjemplo: false, cliente })
    afirmar.igual((await servicio.obtenerReporte(7, { periodo: 'semestre' })).promedioGeneral, 70)
    await servicio.obtenerDetalle(7, {})
    await servicio.obtenerFalencias(7)
    afirmar.profundo(cliente.llamadas.map((llamada) => llamada.ruta), [
      '/api/docente/estudiantes/7/reporte?periodo=semestre',
      '/api/docente/estudiantes/7/detalle',
      '/api/docente/estudiantes/7/falencias'
    ])
  })

  prueba('las recomendaciones llegan con id de texto', async () => {
    const recomendacion = { id: 5, texto: 'Leer', incluida: true, propia: true }
    const cliente = crearClienteFalso({
      'GET /api/docente/estudiantes/7/recomendaciones': { estudiante: { id: 7 }, recomendaciones: [recomendacion] },
      'POST /api/docente/estudiantes/7/recomendaciones': (cuerpo) => ({ recomendacion: { ...recomendacion, texto: cuerpo.texto } }),
      'PATCH /api/docente/estudiantes/7/recomendaciones/5': (cuerpo) => ({ recomendacion: { ...recomendacion, ...cuerpo } }),
      'DELETE /api/docente/estudiantes/7/recomendaciones/5': null
    })
    const servicio = crearServicioDocente({ usarDatosEjemplo: false, cliente })
    afirmar.igual((await servicio.listarRecomendaciones(7)).recomendaciones[0].id, '5')
    afirmar.igual((await servicio.agregarRecomendacion(7, '  Escuchar  ')).texto, 'Escuchar')
    afirmar.igual((await servicio.actualizarRecomendacion(7, '5', { incluida: false })).incluida, false)
    afirmar.profundo(await servicio.eliminarRecomendacion(7, '5'), { eliminada: '5' })
    await afirmar.rechaza(servicio.enviarReportePadres(7), 'SERVICIO_NO_DISPONIBLE')
  })
})

describir('servicioProgreso con la API real', (prueba) => {
  prueba('consulta el progreso del estudiante con el periodo', async () => {
    const cliente = crearClienteFalso({ 'GET /api/estudiante/progreso': { promedioGeneral: 81 } })
    const servicio = crearServicioProgreso({ usarDatosEjemplo: false, cliente })
    afirmar.igual(servicio.capacidades.datosEjemplo, false)
    afirmar.igual((await servicio.obtenerProgreso({ periodo: 'ultima_semana' })).promedioGeneral, 81)
    afirmar.igual(cliente.llamadas[0].ruta, '/api/estudiante/progreso?periodo=ultima_semana')
    await servicio.obtenerProgreso()
    afirmar.igual(cliente.llamadas[1].ruta, '/api/estudiante/progreso')
  })
})
