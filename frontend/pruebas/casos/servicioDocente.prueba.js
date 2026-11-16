import { describir, afirmar } from '../marco.js'
import { crearServicioDocente, obtenerPeriodo } from '../../js/servicios/docente/servicioDocente.js'

function crearServicio () {
  return crearServicioDocente({ usarDatosEjemplo: true, demoraMs: 0 })
}

describir('servicioDocente', (prueba) => {
  prueba('lista estudiantes y busca sin importar tildes ni mayúsculas', async () => {
    const servicio = crearServicio()
    const todos = await servicio.listarEstudiantes()
    afirmar.verdadero(todos.length >= 5)
    const filtrados = await servicio.listarEstudiantes({ busqueda: 'SOFIA' })
    afirmar.profundo(filtrados.map((estudiante) => estudiante.nombre), ['Sofía Ramírez'])
  })

  prueba('el reporte del último mes coincide con el diseño de referencia', async () => {
    const reporte = await crearServicio().obtenerReporte(3)
    afirmar.igual(reporte.promedioGeneral, 78)
    afirmar.igual(reporte.variacion, 5)
    afirmar.profundo(reporte.areas.map((area) => area.valor), [85, 70, 75, 80])
  })

  prueba('el reporte cambia según el periodo y un periodo desconocido usa el último mes', async () => {
    const servicio = crearServicio()
    const semestre = await servicio.obtenerReporte(3, { periodo: 'semestre' })
    afirmar.igual(semestre.periodo, 'semestre')
    afirmar.verdadero(semestre.promedioGeneral < 78)
    const desconocido = await servicio.obtenerReporte(3, { periodo: 'otro' })
    afirmar.igual(desconocido.periodo, 'ultimo_mes')
    afirmar.igual(obtenerPeriodo('otro').etiqueta, 'Último mes')
  })

  prueba('la evolución termina en el promedio del periodo', async () => {
    const servicio = crearServicio()
    for (const periodo of ['ultima_semana', 'ultimo_mes', 'semestre']) {
      const [detalle, reporte] = await Promise.all([servicio.obtenerDetalle(3, { periodo }), servicio.obtenerReporte(3, { periodo })])
      afirmar.igual(detalle.evolucion.length, 7, periodo)
      afirmar.igual(detalle.evolucion[6].valor, reporte.promedioGeneral, periodo)
    }
  })

  prueba('las falencias van de la más baja a la más alta', async () => {
    const { falencias } = await crearServicio().obtenerFalencias(3)
    afirmar.profundo(falencias.map((falencia) => falencia.porcentaje), [60, 65, 68])
    afirmar.igual(falencias[0].area, 'Gramática')
  })

  prueba('las áreas a mejorar son las dos falencias más bajas', async () => {
    const detalle = await crearServicio().obtenerDetalle(3)
    afirmar.profundo(detalle.areasMejorar, ['Gramática', 'Vocabulario'])
    afirmar.verdadero(detalle.fortalezas[0].includes('Pronunciación'))
  })

  prueba('gestiona recomendaciones: agregar, excluir y eliminar', async () => {
    const servicio = crearServicio()
    const { recomendaciones } = await servicio.listarRecomendaciones(3)
    afirmar.igual(recomendaciones.length, 3)
    afirmar.verdadero(recomendaciones.every((recomendacion) => recomendacion.incluida))

    const nueva = await servicio.agregarRecomendacion(3, '  Ver una serie en inglés  ')
    afirmar.igual(nueva.texto, 'Ver una serie en inglés')
    afirmar.igual(nueva.propia, true)

    await servicio.actualizarRecomendacion(3, recomendaciones[0].id, { incluida: false })
    await servicio.eliminarRecomendacion(3, nueva.id)
    const despues = (await servicio.listarRecomendaciones(3)).recomendaciones
    afirmar.igual(despues.length, 3)
    afirmar.igual(despues[0].incluida, false)
  })

  prueba('no permite recomendaciones vacías', async () => {
    await afirmar.rechaza(crearServicio().agregarRecomendacion(3, '   '), 'DATOS_INVALIDOS')
  })

  prueba('modificar lo recibido no altera los datos del servicio', async () => {
    const servicio = crearServicio()
    const { recomendaciones } = await servicio.listarRecomendaciones(1)
    recomendaciones[0].texto = 'cambiado'
    const otraVez = await servicio.listarRecomendaciones(1)
    afirmar.verdadero(otraVez.recomendaciones[0].texto !== 'cambiado')
  })

  prueba('un estudiante inexistente responde ESTUDIANTE_NO_ENCONTRADO', async () => {
    await afirmar.rechaza(crearServicio().obtenerReporte(999), 'ESTUDIANTE_NO_ENCONTRADO')
  })

  prueba('las alertas incluyen promedios bajos o en descenso', async () => {
    const alertas = await crearServicio().listarAlertas()
    afirmar.verdadero(alertas.some((alerta) => alerta.nombre === 'Samuel Rojas'))
    afirmar.verdadero(!alertas.some((alerta) => alerta.nombre === 'Daniela Castro'))
  })

  prueba('el envío a padres no está disponible', async () => {
    const servicio = crearServicio()
    afirmar.igual(servicio.capacidades.envioPadres, false)
    await afirmar.rechaza(servicio.enviarReportePadres(3), 'SERVICIO_NO_DISPONIBLE')
  })

  prueba('sin datos de ejemplo, responde que el servicio no está disponible', async () => {
    const servicio = crearServicioDocente({ usarDatosEjemplo: false, demoraMs: 0 })
    await afirmar.rechaza(servicio.listarEstudiantes(), 'SERVICIO_NO_DISPONIBLE')
  })
})
