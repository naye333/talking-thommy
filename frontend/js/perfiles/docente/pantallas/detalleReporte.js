// Detalle del reporte: evolución del progreso, fortalezas y áreas a mejorar.
import { html, renderizar } from '../../../nucleo/dom.js'
import { plantillaPantalla, encabezado } from '../../../componentes/estructura.js'
import { avisoDatosEjemplo } from '../../../componentes/elementos.js'
import { tarjetaLista, enlaceSeccion } from '../../../componentes/tarjetas.js'
import { graficoLinea } from '../../../componentes/graficos.js'
import { cargarRegion } from '../../../componentes/estados.js'
import { icono } from '../../../componentes/iconos.js'
import { obtenerPeriodo } from '../../../servicios/docente/servicioDocente.js'
import { navegacionDocente, RUTAS_DOCENTE } from '../navegacion.js'
import { seleccionEstudiante } from '../estado.js'

export function pantallaDetalleReporte ({ contenedor, params, query }, app) {
  const servicio = app.servicios.docente
  const estudianteId = Number(params.id)
  const periodo = obtenerPeriodo(query.periodo)
  seleccionEstudiante.guardar(estudianteId)

  renderizar(contenedor, plantillaPantalla({
    cabecera: encabezado({ titulo: 'Detalle del Reporte', rutaAtras: `${RUTAS_DOCENTE.reporte(estudianteId)}?periodo=${periodo.valor}` }),
    contenido: html`<div class="detalle-reporte" data-region="detalle"></div>`,
    navegacion: navegacionDocente()
  }))

  cargarRegion(contenedor.querySelector('[data-region="detalle"]'), {
    cargar: () => servicio.obtenerDetalle(estudianteId, { periodo: periodo.valor }),
    textoCargando: 'Cargando detalle…',
    mostrar: ({ estudiante, evolucion, fortalezas, areasMejorar }) => html`
      <section class="tarjeta evolucion">
        <h2 class="evolucion__titulo">${icono('barras', { clase: 'evolucion__icono' })}Evolución de su progreso</h2>
        <p class="evolucion__subtitulo">${estudiante.nombre} · ${periodo.etiqueta}</p>
        ${graficoLinea({
          puntos: evolucion,
          descripcion: `Evolución de ${estudiante.nombre}: de ${evolucion[0]?.valor}% a ${evolucion[evolucion.length - 1]?.valor}%`
        })}
      </section>

      ${tarjetaLista({
        titulo: 'Fortalezas',
        iconoTitulo: 'estrella',
        iconoElemento: 'exito',
        elementos: fortalezas,
        textoVacio: 'Aún no hay fortalezas registradas.'
      })}

      ${tarjetaLista({
        titulo: 'Áreas a mejorar',
        iconoTitulo: 'alertaRoja',
        iconoElemento: 'exclamacion',
        elementos: areasMejorar,
        textoVacio: 'No hay áreas por mejorar en este periodo.'
      })}

      ${enlaceSeccion({ titulo: 'Acciones', descripcion: 'Sugerencias para reforzar y envío del reporte', iconoNombre: 'portapapeles', ruta: RUTAS_DOCENTE.acciones(estudianteId) })}
      ${avisoDatosEjemplo({ visible: servicio.capacidades.datosEjemplo })}`
  })
}
